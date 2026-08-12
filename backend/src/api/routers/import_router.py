import os
import time
import uuid
import hashlib
import logging
import asyncio
from collections import OrderedDict
from typing import Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse

from src.core.security import verify_token_optional, get_request_token
from src.services.supabase_client import get_supabase_client, get_user_supabase_client
from src.services.chunker import TravelDocumentChunker
from src.services.embedder import embedder
from src.services.vector_store import vector_store
from src.services.r2_storage_service import upload_file_to_r2
from src.services.semantic_cache_service import compute_content_hash, get_cached_recommendation, store_cached_recommendation
from src.services.vault_knowledge_service import (
    save_vault_package,
    accumulate_destination_knowledge,
    perform_pdf_delta_sync,
    SECTION_TITLES
)
from src.services.pdf_vault_service import deterministic_pre_parse_and_compress
from src.services.import_service import PdfExtractor, XlsxExtractor, CsvExtractor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/import")

JOB_TTL_SECONDS = 60 * 60
MAX_TRACKED_JOBS = 500

# The extraction result is cached in the browser's localStorage by vaultStore, so
# the raw text echoed back on the payload has to stay well inside that quota.
RAW_TEXT_PAYLOAD_LIMIT = 100_000

# Matches the cap the previous PdfEngine-based path enforced.
MAX_PDF_PAGES = 200

EXTRACTION_JOBS: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def _prune_extraction_jobs() -> None:
    """Drop jobs that are older than the TTL, then trim to the size cap."""
    now = time.time()
    stale = [
        jid for jid, job in EXTRACTION_JOBS.items()
        if now - job.get("created_at", now) > JOB_TTL_SECONDS
    ]
    for jid in stale:
        EXTRACTION_JOBS.pop(jid, None)

    while len(EXTRACTION_JOBS) > MAX_TRACKED_JOBS:
        EXTRACTION_JOBS.popitem(last=False)


def _assert_pdf_within_page_limit(file_bytes: bytes) -> None:
    """
    Reject absurdly long PDFs before extraction.

    `PdfExtractor` runs three extraction strategies plus per-page table
    detection, so an inflated page count is the expensive input to guard.
    """
    try:
        import fitz
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            page_count = doc.page_count
    except Exception as e:
        logger.warning(f"[ImportProcess] Could not pre-read page count: {e}")
        return

    if page_count > MAX_PDF_PAGES:
        raise ValueError(
            f"PDF has {page_count} pages (max allowed: {MAX_PDF_PAGES}). "
            "Split the file or remove unnecessary pages."
        )


def _set_job(job_id: str, **fields: Any) -> None:
    """Create or update a tracked job, preserving its created_at stamp."""
    job = EXTRACTION_JOBS.get(job_id)
    if job is None:
        job = {"created_at": time.time()}
        EXTRACTION_JOBS[job_id] = job
    job.update(fields)

def accumulate_agency_packing_rules(
    destination: str,
    extra_sections: Dict[str, str],
    agency_id: Optional[str],
    token: Optional[str]
):
    """
    Persists packing lists and custom extra sections learned from files
    exclusively to the agency_packing_rules table scoped by agency_id.
    """
    if not agency_id or not destination or not extra_sections:
        return
        
    sb = get_user_supabase_client(token)
    if not sb:
        return
        
    dest_kw = destination.lower().strip()
    for sec_type, content in extra_sections.items():
        if not content or not content.strip():
            continue
            
        title = SECTION_TITLES.get(sec_type, sec_type.replace("_", " ").title())
        try:
            data = {
                "agency_id": agency_id,
                "destination_keyword": dest_kw,
                "section_type": sec_type,
                "section_title": title,
                "content": content.strip()
            }
            sb.table("agency_packing_rules").upsert(
                data,
                on_conflict="agency_id,destination_keyword,section_type"
            ).execute()
            logger.info(f"[Agency Packing Rules] Accumulated exclusive memory for {dest_kw} ({sec_type})")
        except Exception as e:
            logger.error(f"[Agency Packing Rules] Failed to upsert exclusive rule for {dest_kw} ({sec_type}): {e}")

def _run_extraction_bg(
    job_id: str,
    file_bytes: bytes,
    filename: str,
    destination: str,
    budget: float,
    duration: int,
    currency: str,
    preview_only: bool,
    reparse: bool,
    agency_id: Optional[str],
    user_id: Optional[str],
    token: Optional[str]
):
    ext = (filename.split(".")[-1] if "." in filename else "").lower()
    raw_text = ""
    try:
        _set_job(
            job_id,
            status="extracting",
            progress={"stage": "Uploading & Analyzing Document", "current": 1, "total": 4},
            result=None,
            error=None,
            raw_text=None,
        )

        _set_job(job_id, progress={"stage": "Extracting Text & Structured Content", "current": 2, "total": 4})

        if ext == "pdf":
            _assert_pdf_within_page_limit(file_bytes)
            extractor = PdfExtractor()
        elif ext in ("xlsx", "xls"):
            extractor = XlsxExtractor()
        else:
            extractor = CsvExtractor()

        normalized = asyncio.run(extractor.extract(
            file_bytes=file_bytes,
            filename=filename,
            destination_hint=destination,
            budget_hint=budget,
            duration_hint=duration,
            currency_hint=currency,
            agency_id=agency_id,
            user_id=user_id
        ))

        # `_raw_text` is echoed back by the review modal on /import/confirm and
        # from there uploaded to R2, so it stays on the payload — but capped, as
        # the whole result is cached in the browser's localStorage.
        raw_text = normalized.pop("_raw_text", "") or ""
        normalized.pop("_storage_meta", None)
        normalized["_raw_text"] = raw_text[:RAW_TEXT_PAYLOAD_LIMIT]
        _set_job(job_id, raw_text=raw_text[:50000])

        normalized["agency_id"] = agency_id
        normalized["file_hash"] = hashlib.sha256(file_bytes).hexdigest()[:16]
        normalized["file_size_mb"] = round(len(file_bytes) / 1_048_576, 2)

        _set_job(job_id, progress={"stage": "Indexing Entities & Vector Knowledge", "current": 3, "total": 4})

        sb = get_user_supabase_client(token, agency_id) if token else get_supabase_client()

        delta_summary = perform_pdf_delta_sync(
            extracted_pkg=normalized,
            agency_id=agency_id,
            sb=sb
        )
        normalized["delta_summary"] = delta_summary

        if raw_text and agency_id:
            try:
                doc_dest = normalized.get("destination") or destination or "General"
                chunker_svc = TravelDocumentChunker()
                chunks = chunker_svc.chunk_text(raw_text, metadata={
                    "document_name": filename,
                    "destination": doc_dest,
                    "agency_id": agency_id,
                    "source_type": ext,
                    "file_url": ""
                })
                if chunks:
                    chunk_texts = [c["content"] for c in chunks]
                    embeddings = embedder.embed_texts(chunk_texts)
                    stored_count = vector_store.store_chunks(
                        agency_id=agency_id,
                        document_id=job_id,
                        chunks=chunks,
                        embeddings=embeddings
                    )
                    normalized["chunks_indexed"] = stored_count
            except Exception as embed_err:
                logger.error(f"[ImportProcess] Background RAG embedding error: {embed_err}")

        _set_job(
            job_id,
            progress={"stage": "Done", "current": 4, "total": 4},
            status="completed",
            result=normalized,
        )

    except Exception as e:
        logger.exception(f"Background extraction failed for job {job_id}")
        if not raw_text and ext == "pdf":
            try:
                import fitz
                with fitz.open(stream=file_bytes, filetype="pdf") as doc:
                    raw_text = "\n\n".join(page.get_text() for page in doc)
            except Exception:
                pass

        _set_job(
            job_id,
            status="failed",
            error=str(e),
            raw_text=raw_text[:50000] if raw_text else "",
        )
    finally:
        _prune_extraction_jobs()

@router.post("/process")
async def process_file_import(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    agency_id: str = Form("demo-agency"),
    destination: str = Form(""),
    budget: float = Form(0.0),
    duration: int = Form(0),
    currency: str = Form("INR"),
    preview_only: bool = Form(False),
    reparse: bool = Form(True),
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token),
):
    """
    Unified Import Processing Endpoint:
    Accepts PDF/CSV/XLSX, creates an async processing job, and immediately returns a job_id for polling.
    """
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    except Exception as e:
        logger.error(f"[ImportProcess] Failed to check file size: {e}")
        file_size = 0

    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 50MB limit")

    file_bytes = await file.read()
    filename = file.filename or "uploaded_doc.pdf"

    resolved_agency_id = agency_id
    user_id = None
    if isinstance(user, dict):
        resolved_agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
            or agency_id
        )
        user_id = user.get("sub") or user.get("id")

    job_id = str(uuid.uuid4())
    _prune_extraction_jobs()
    _set_job(
        job_id,
        status="queued",
        progress={"stage": "Queued", "current": 0, "total": 4},
        result=None,
        error=None,
        raw_text=None,
    )

    background_tasks.add_task(
        _run_extraction_bg,
        job_id=job_id,
        file_bytes=file_bytes,
        filename=filename,
        destination=destination,
        budget=budget,
        duration=duration,
        currency=currency,
        preview_only=preview_only,
        reparse=reparse,
        agency_id=resolved_agency_id,
        user_id=user_id,
        token=token
    )

    return JSONResponse(content={"status": "queued", "job_id": job_id})

@router.get("/status/{job_id}")
async def get_import_status(job_id: str):
    """
    Polls current status of an async extraction job by job_id.
    """
    job = EXTRACTION_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Extraction job '{job_id}' not found.")
    return JSONResponse(content=job)

@router.post("/extract-text")
async def extract_raw_text(
    file: UploadFile = File(...),
    agency_id: str = Form("demo-agency")
):
    """
    Raw text fallback extraction using PyMuPDF / pdfminer without LLM processing.
    """
    try:
        file_bytes = await file.read()
        raw_text = ""
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            raw_text = "\n\n".join([page.get_text() for page in doc])
        except Exception as e:
            logger.warning(f"[ExtractText] PyMuPDF failed: {e}")
            from pdfminer.high_level import extract_text
            import io
            raw_text = extract_text(io.BytesIO(file_bytes))

        return JSONResponse(content={"status": "success", "text": raw_text})
    except Exception as e:
        logger.error(f"[ExtractText] Failed to extract raw text: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "text": "", "message": str(e)})

@router.post("/confirm")
async def confirm_file_import(
    payload: Dict[str, Any],
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token),
):
    """
    Saves a confirmed/agent-reviewed extraction package to vault_packages,
    and accumulates destination knowledge and agency rules.
    """
    try:
        agency_id = None
        user_id = None
        if isinstance(user, dict):
            agency_id = (
                (user.get("user_metadata") or {}).get("agency_id")
                or (user.get("app_metadata") or {}).get("agency_id")
                or user.get("agency_id")
            )
            user_id = user.get("sub") or user.get("id")

        filename = payload.pop("_pdf_filename", payload.get("pdf_filename", "confirmed_package.pdf"))
        file_hash = payload.pop("_pdf_hash", payload.get("pdf_hash", hashlib.md5(str(payload).encode()).hexdigest()))
        file_url = payload.pop("_pdf_url", payload.get("pdf_url", ""))
        raw_text = payload.pop("_raw_text", "")
        hash_key = payload.pop("_hash_key", None)

        from src.services.import_service import build_normalized_fields
        fields_dict = build_normalized_fields(payload, payload.get("source_type", "pdf"))
        payload["fields"] = fields_dict
        conf_scores = [f_meta["confidence"] for f_meta in fields_dict.values()]
        payload["overall_confidence_score"] = round(sum(conf_scores) / len(conf_scores), 2) if conf_scores else 0.95

        dest_for_knowledge = payload.get("destination", "")
        extra_sections = payload.get("extra_sections") or {}

        def _bg_persist():
            try:
                save_vault_package(
                    parsed_data=payload,
                    pdf_filename=filename,
                    pdf_hash=file_hash,
                    agency_id=agency_id,
                    user_id=user_id,
                    pdf_url=file_url,
                    raw_text=raw_text,
                    extraction_version="v3.0.0-reviewed"
                )
                if extra_sections and dest_for_knowledge:
                    accumulate_destination_knowledge(
                        destination=dest_for_knowledge,
                        extra_sections=extra_sections,
                        agency_id=agency_id,
                        user_id=user_id
                    )
                    accumulate_agency_packing_rules(
                        destination=dest_for_knowledge,
                        extra_sections=extra_sections,
                        agency_id=agency_id,
                        token=token
                    )
            except Exception as ex:
                logger.error(f"[VaultKnowledge] Background persist error: {ex}")

        asyncio.create_task(asyncio.to_thread(_bg_persist))

        if hash_key:
            try:
                sb = get_user_supabase_client(token, agency_id) if token else get_supabase_client()
                asyncio.create_task(store_cached_recommendation(
                    hash_key,
                    dict(payload),
                    dest_for_knowledge,
                    payload.get("total_price") or 0.0,
                    supabase_client=sb,
                    agency_id=agency_id
                ))
            except Exception as e:
                logger.warn(f"Recommendation cache store warning: {e}")

        return JSONResponse(content={
            "status": "success",
            "message": "Package confirmed and saved to Vault successfully.",
            "data": payload
        })
    except Exception as e:
        logger.exception("Failed to confirm and save vault package")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
