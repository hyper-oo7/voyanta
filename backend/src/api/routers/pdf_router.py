"""
pdf_router.py — Vault V2
=========================
Changes:
- budget is now OPTIONAL (comes from PDF, not user input)
- Stores parsed package to Supabase vault_packages table
- Accumulates static sections into destination_knowledge table
- Auto-detects currency from PDF text
- Returns faithfully extracted single package
"""
import os
import hashlib
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from typing import Any, Optional

from src.models.api_models import PDFGenerateRequest
from src.core.security import verify_token, verify_token_optional
from src.services.pdf_vault_service import (
    save_temporary_pdf,
    extract_text_from_pdf,
    deterministic_pre_parse_and_compress,
    extract_images_and_link_spatially,
)
from src.services.semantic_cache_service import compute_content_hash, get_cached_recommendation, store_cached_recommendation
from src.services.cascading_ai_service import route_model_cascading
from src.services.vault_knowledge_service import (
    save_vault_package,
    accumulate_destination_knowledge,
)
from src.services.r2_storage_service import upload_file_to_r2
from src.services.knowledge_extraction_service import extract_knowledge_objects, save_knowledge_objects
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf")
PDF_SERVICE_URL = os.environ.get("PDF_SERVICE_URL", "http://127.0.0.1:8002")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY")
if not INTERNAL_API_KEY:
    raise RuntimeError("FATAL: INTERNAL_API_KEY environment variable is not set.")


@router.get("/health")
async def pdf_health():
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(f"{PDF_SERVICE_URL}/health")
            return JSONResponse(status_code=res.status_code, content=res.json())
        except Exception as e:
            logger.exception("PDF service health check failed")
            return JSONResponse(status_code=503, content={"ok": False, "error": str(e)})


@router.post("/generate")
async def pdf_generate(request: PDFGenerateRequest, user: Any = Depends(verify_token)):
    payload = request.model_dump(exclude_none=True)
    if not payload.get("proposal_id") and not payload.get("html"):
        raise HTTPException(status_code=400, detail="Missing proposal_id or html")

    headers = {"x-internal-api-key": INTERNAL_API_KEY}
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            res = await client.post(f"{PDF_SERVICE_URL}/generate", json=payload, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.text)

            filename = payload.get("name") or payload.get("proposal_id") or "proposal"
            filename = "".join(c if c.isalnum() or c in (".", "_", "-") else "-" for c in filename)

            return Response(
                content=res.content,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'}
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PDF service call failed")
            raise HTTPException(status_code=500, detail=f"PDF service failure: {str(e)}")


@router.post("/vault-process")
async def process_vault_pdf(
    file: UploadFile = File(...),
    destination: str = Form(""),          # Optional hint — actual destination extracted from PDF
    budget: float = Form(0),              # Optional budget hint for cache keying only
    duration: int = Form(0),             # Optional duration hint — actual duration extracted from PDF
    currency: str = Form("INR"),          # Default but overridden by PDF-detected currency
    user: Any = Depends(verify_token_optional),
):
    """
    Vault V2 Pipeline:
    1. 15-Day Server Storage
    2. Full text extraction (PyMuPDF + pdfminer.six, zero data loss)
    3. Deterministic pre-parse (strip boilerplate, keep itinerary content)
    4. Semantic Cache check ($0 cost if matched)
    5. Gemini 2.5 Flash: FAITHFUL extraction (extract, never generate)
    6. Store parsed package to Supabase vault_packages
    7. Accumulate static sections into destination_knowledge
    """
    try:
        # ── Resolve user context ───────────────────────────────────────────
        agency_id = None
        user_id = None
        if isinstance(user, dict):
            agency_id = (
                (user.get("user_metadata") or {}).get("agency_id")
                or (user.get("app_metadata") or {}).get("agency_id")
                or user.get("agency_id")
            )
            user_id = user.get("sub") or user.get("id")
            logger.info(f"[VaultProcess] Authenticated user (agency_id={agency_id}, user_id={user_id})")
        else:
            logger.info("[VaultProcess] Processing as unauthenticated/demo user")

        # ── Step 1: Save PDF & Upload to R2 ─────────────────────────────────
        file_bytes = await file.read()
        pdf_hash = hashlib.sha256(file_bytes).hexdigest()
        storage_meta = save_temporary_pdf(file_bytes, file.filename or "supplier_package.pdf")
        
        r2_upload_res = upload_file_to_r2(
            file_bytes=file_bytes,
            filename=file.filename or "supplier_package.pdf",
            folder="supplier-pdfs",
            agency_id=agency_id,
            content_type="application/pdf"
        )
        pdf_url = r2_upload_res.get("url") if r2_upload_res else None

        # Insert upload trace to public.supplier_pdfs
        source_pdf_id = None
        sb = get_supabase_client()
        if sb:
            try:
                pdf_record = {
                    "filename": file.filename or "supplier_package.pdf",
                    "file_path": pdf_url or storage_meta["file_path"],
                    "size_bytes": storage_meta["size_bytes"],
                    "status": "active"
                }
                if agency_id:
                    pdf_record["agency_id"] = agency_id
                
                pdf_insert_res = sb.table("supplier_pdfs").insert(pdf_record).execute()
                if pdf_insert_res.data:
                    source_pdf_id = pdf_insert_res.data[0]["id"]
                    logger.info(f"[VaultProcess] Created supplier_pdfs row: id={source_pdf_id}")
            except Exception as pdf_err:
                logger.error(f"[VaultProcess] Failed to insert supplier_pdfs row: {pdf_err}")

        # ── Step 2: Text extraction ────────────────────────────────────────
        context_prefix = f"Destination hint: {destination}.\n" if destination else ""
        try:
            extracted_text, extraction_metrics = extract_text_from_pdf(storage_meta["file_path"])
            raw_text = context_prefix + extracted_text
            logger.info(
                f"[VaultProcess] Extraction — strategy={extraction_metrics.get('winning_strategy')}, "
                f"chars={extraction_metrics.get('chars_extracted')}"
            )
        except ValueError as extract_err:
            logger.error(f"[VaultProcess] All extraction strategies failed: {extract_err}")
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unable to extract text from this PDF. This PDF appears to be fully image-based "
                    "(a scanned document). Please use a digitally-created PDF or export the itinerary "
                    "as a text-based PDF from Word/Google Docs."
                )
            )

        # ── Step 2b: Extract atomic knowledge objects ──────────────────────
        try:
            extracted_objs = await extract_knowledge_objects(raw_text)
            if extracted_objs:
                save_knowledge_objects(extracted_objs, agency_id=agency_id, source_pdf_id=source_pdf_id)
        except Exception as ke_err:
            logger.error(f"[VaultProcess] Knowledge extraction failed: {ke_err}")

        # ── Step 3: Deterministic pre-parse (strip only boilerplate) ───────
        compressed_text, compression_metrics = deterministic_pre_parse_and_compress(raw_text)

        # ── Step 4: Extract embedded images from PDF ───────────────────────
        images_list = extract_images_and_link_spatially(storage_meta["file_path"])

        # ── Step 5: Semantic Cache check ───────────────────────────────────
        hash_key = compute_content_hash(compressed_text, budget, duration)
        cached_result = await get_cached_recommendation(hash_key, agency_id=agency_id)

        if cached_result:
            logger.info(f"[VaultProcess] Semantic cache HIT — returning $0 cached result")
            return JSONResponse(content={
                "status": "success",
                "cache_hit": True,
                "cost_incurred": "$0.00 (Served instantly from Semantic Cache)",
                "storage_meta": {**storage_meta, "pdf_url": pdf_url},
                "compression_metrics": compression_metrics,
                "pdf_hash": pdf_hash,
                "data": cached_result,
            })

        # ── Step 6: Gemini faithful extraction ────────────────────────────
        ai_result = await route_model_cascading(
            compressed_text=compressed_text,
            images=images_list,
            destination=destination,
            budget=budget,
            duration=duration,
            currency=currency,
        )

        # ── Step 7: Store parsed package to Supabase vault_packages ───────
        extracted_pkg = ai_result.get("extracted_package") or (
            ai_result.get("recommendations", [{}])[0]
        )
        if extracted_pkg:
            saved = save_vault_package(
                parsed_data=extracted_pkg,
                pdf_filename=file.filename or "supplier_package.pdf",
                pdf_hash=pdf_hash,
                agency_id=agency_id,
                user_id=user_id,
                pdf_url=pdf_url,
            )
            if saved:
                ai_result["vault_package_id"] = saved.get("id")
                logger.info(f"[VaultProcess] Saved to vault_packages: id={saved.get('id')}")

        # ── Step 8: Accumulate destination knowledge ───────────────────────
        extra_sections = ai_result.get("extra_sections") or {}
        dest_for_knowledge = ai_result.get("detected_destination") or destination
        if extra_sections and dest_for_knowledge:
            accumulate_destination_knowledge(
                destination=dest_for_knowledge,
                extra_sections=extra_sections,
                agency_id=agency_id,
                user_id=user_id,
            )

        # ── Step 9: Store in Semantic Cache ───────────────────────────────
        await store_cached_recommendation(hash_key, ai_result, destination, budget, agency_id=agency_id)

        return JSONResponse(content={
            "status": "success",
            "cache_hit": False,
            "cost_incurred": "Optimized via Gemini Faithful Extraction",
            "storage_meta": {**storage_meta, "pdf_url": pdf_url},
            "compression_metrics": compression_metrics,
            "pdf_hash": pdf_hash,
            "data": ai_result,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Vault PDF processing failed")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
