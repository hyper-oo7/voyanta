import os
import hashlib
import logging
import asyncio
from typing import Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from src.core.security import verify_token_optional, get_request_token
from src.services.supabase_client import get_supabase_client, get_user_supabase_client
from src.services.r2_storage_service import upload_file_to_r2
from src.services.semantic_cache_service import compute_content_hash, get_cached_recommendation, store_cached_recommendation
from src.services.vault_knowledge_service import (
    save_vault_package,
    accumulate_destination_knowledge,
    SECTION_TITLES
)
from src.services.pdf_vault_service import deterministic_pre_parse_and_compress
from src.services.import_service import PdfExtractor, XlsxExtractor, CsvExtractor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/import")

def accumulate_agency_packing_rules(
    destination: str,
    extra_sections: Dict[str, str],
    agency_id: Optional[str],
    token: Optional[str]
):
    """
    Persists packing lists and custom extra sections learned from files
    exclusively to the agency_packing_rules table scoped by agency_id (Rule 5).
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
            # Upsert using standard combination key
            sb.table("agency_packing_rules").upsert(
                data,
                on_conflict="agency_id,destination_keyword,section_type"
            ).execute()
            logger.info(f"[Agency Packing Rules] Accumulated exclusive memory for {dest_kw} ({sec_type})")
        except Exception as e:
            logger.error(f"[Agency Packing Rules] Failed to upsert exclusive rule for {dest_kw} ({sec_type}): {e}")

@router.post("/process")
async def process_file_import(
    file: UploadFile = File(...),
    destination: str = Form(""),
    budget: float = Form(0.0),
    duration: int = Form(0),
    currency: str = Form("INR"),
    preview_only: bool = Form(True),
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token),
):
    """
    Unified Import Processing Endpoint:
    Processes PDF, XLSX, and CSV file formats, computes confidence metadata,
    and supports preview_only pre-save review workflow.
    """
    # 1. Size Validation (50MB limit)
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    except Exception as e:
        logger.error(f"[ImportProcess] Failed to check file size: {e}")
        file_size = 0

    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 50MB limit")

    try:
        # 2. Context Isolation
        agency_id = None
        user_id = None
        if isinstance(user, dict):
            agency_id = (
                (user.get("user_metadata") or {}).get("agency_id")
                or (user.get("app_metadata") or {}).get("agency_id")
                or user.get("agency_id")
            )
            user_id = user.get("sub") or user.get("id")
            
        logger.info(f"[ImportProcess] Start - file={file.filename}, agency_id={agency_id}, user_id={user_id}, preview_only={preview_only}")

        # Initialize Supabase client
        if token:
            sb = get_user_supabase_client(token, agency_id)
        else:
            sb = get_supabase_client()

        # 3. Entitlements Check (if authenticated with an agency)
        if agency_id:
            from src.core.entitlements import get_agency_entitlements_data, check_feature_entitlement
            try:
                entitlements = await get_agency_entitlements_data(sb, agency_id)
                check_feature_entitlement(entitlements, "ai_vault")
            except HTTPException as http_e:
                # If specifically 403 upgrade required, bubble up
                if http_e.status_code == 403:
                    raise http_e
            except Exception as ent_err:
                logger.warning(f"[ImportProcess] Entitlements check fallback: {ent_err}")

        # 4. Upload original file to R2
        file_bytes = await file.read()
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        
        # Determine MIME and extractor
        filename = file.filename or "supplier_file"
        ext = (filename.split(".")[-1] if "." in filename else "").lower()
        
        if ext == "pdf":
            if b"%PDF-" not in file_bytes[:1024]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid PDF file structure. Only valid PDF files starting with '%PDF-' magic bytes are allowed."
                )
            content_type = "application/pdf"
            extractor = PdfExtractor()
            file_type = "pdf"
        elif ext in ("xlsx", "xls"):
            if not (file_bytes.startswith(b"PK\x03\x04") or file_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Excel file structure. Only valid spreadsheet files (.xlsx or .xls) are allowed."
                )
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            extractor = XlsxExtractor()
            file_type = "xlsx"
        elif ext == "csv":
            if file_bytes.startswith(b"PK\x03\x04") or file_bytes.startswith(b"%PDF-") or b"\x00" in file_bytes[:1024]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid CSV file structure. Binary format or unsupported content detected."
                )
            content_type = "text/csv"
            extractor = CsvExtractor()
            file_type = "csv"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

        r2_upload_res = await asyncio.to_thread(
            upload_file_to_r2,
            file_bytes=file_bytes,
            filename=filename,
            folder="supplier-pdfs",
            agency_id=agency_id,
            content_type=content_type
        )
        file_url = r2_upload_res.get("url") if r2_upload_res else None

        # Insert upload trace to public.supplier_pdfs
        source_pdf_id = None
        if sb:
            try:
                pdf_record = {
                    "filename": filename,
                    "file_path": file_url or f"temp_supplier_pdfs/{filename}",
                    "size_bytes": len(file_bytes),
                    "status": "active"
                }
                if agency_id:
                    pdf_record["agency_id"] = agency_id
                
                pdf_insert_res = sb.table("supplier_pdfs").insert(pdf_record).execute()
                if pdf_insert_res.data:
                    source_pdf_id = pdf_insert_res.data[0]["id"]
                    logger.info(f"[ImportProcess] Created supplier_pdfs row: id={source_pdf_id}")
            except Exception as pdf_err:
                logger.error(f"[ImportProcess] Failed to insert supplier_pdfs row: {pdf_err}")

        # 5. Extract via multi-reader pipeline
        normalized = await extractor.extract(
            file_bytes=file_bytes,
            filename=filename,
            destination_hint=destination,
            budget_hint=budget,
            duration_hint=duration,
            currency_hint=currency,
            agency_id=agency_id,
            user_id=user_id
        )

        storage_meta = normalized.pop("_storage_meta", {
            "file_path": file_url or "",
            "filename": filename,
            "size_bytes": len(file_bytes)
        })
        compression_metrics = normalized.pop("_compression_metrics", {
            "original_chars": len(normalized.get("_raw_text", "")),
            "compressed_chars": len(normalized.get("_raw_text", "")),
            "savings_percentage": "0%"
        })
        raw_text = normalized.pop("_raw_text", "")

        # Compute hash key from the compressed text/raw text
        compressed_text, _ = deterministic_pre_parse_and_compress(raw_text)
        hash_key = compute_content_hash(compressed_text, budget, duration or normalized.get("duration_days", 7))
        
        # Check cache
        cached_result = await get_cached_recommendation(hash_key, supabase_client=sb, agency_id=agency_id)
        if cached_result:
            logger.info(f"[ImportProcess] Cache HIT for hash {hash_key[:8]}")
            if "fields" not in cached_result:
                from src.services.import_service import build_normalized_fields
                cached_result["fields"] = build_normalized_fields(cached_result, file_type)
            
            return JSONResponse(content={
                "status": "success",
                "cache_hit": True,
                "cost_incurred": "$0.00 (Served instantly from Semantic Cache)",
                "storage_meta": {**storage_meta, "pdf_url": file_url},
                "compression_metrics": compression_metrics,
                "pdf_hash": file_hash,
                "data": cached_result
            })

        # Attach metadata to normalized data so confirm step can persist accurately
        normalized["_pdf_filename"] = filename
        normalized["_pdf_hash"] = file_hash
        normalized["_pdf_url"] = file_url
        normalized["_raw_text"] = raw_text
        normalized["_hash_key"] = hash_key

        if not preview_only:
            # Save package directly to DB if not in preview mode
            saved_pkg = save_vault_package(
                parsed_data=normalized,
                pdf_filename=filename,
                pdf_hash=file_hash,
                agency_id=agency_id,
                user_id=user_id,
                pdf_url=file_url,
                raw_text=raw_text,
                extraction_version="v3.0.0"
            )
            if saved_pkg:
                normalized["vault_package_id"] = saved_pkg.get("id")
                logger.info(f"[ImportProcess] Saved to vault_packages: id={saved_pkg.get('id')}")

            # Accumulate destination knowledge
            extra_sections = normalized.get("extra_sections") or {}
            dest_for_knowledge = normalized.get("destination") or destination
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
            await store_cached_recommendation(hash_key, normalized, dest_for_knowledge, budget, supabase_client=sb, agency_id=agency_id)

        return JSONResponse(content={
            "status": "success",
            "cache_hit": False,
            "preview_only": preview_only,
            "cost_incurred": "Optimized via Faithful Extraction",
            "storage_meta": {**storage_meta, "pdf_url": file_url},
            "compression_metrics": compression_metrics,
            "pdf_hash": file_hash,
            "data": normalized
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unified file import processing failed")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

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

        # Recalculate fields metadata if agent edited values
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

        # Launch saving and knowledge accumulation in background thread for instant response (< 50ms)
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
