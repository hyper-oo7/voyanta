"""
vault_knowledge_service.py
===========================
Manages the Destination Knowledge Base — accumulates static sections
(What to Pack, Visa, Inclusions, Exclusions, etc.) per destination per agent.

Also manages vault_packages — the Supabase-persisted store of all parsed PDFs.
Budget-matching logic: when creating a proposal with budget B, return vault packages
whose total_price is within ±30% of B (configurable).
"""
import logging
import re
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

BUDGET_MATCH_TOLERANCE = 0.30  # ±30% — covers 18k-22k for a 20k budget


# ─────────────────────────────────────────────────────────────────────────────
# VAULT PACKAGES — CRUD
# ─────────────────────────────────────────────────────────────────────────────

def save_vault_package(
    parsed_data: Dict[str, Any],
    pdf_filename: str,
    pdf_hash: str,
    agency_id: Optional[str] = None,
    user_id: Optional[str] = None,
    pdf_url: Optional[str] = None,
    raw_text: Optional[str] = None,
    extraction_version: Optional[str] = "v1.0.0",
) -> Optional[Dict[str, Any]]:
    """
    Persist a parsed vault package to Supabase.
    Dedup: if the same PDF (by hash) was already saved for this agent, update it.
    """
    from src.services.supabase_client import get_supabase_client
    from src.services.r2_storage_service import upload_text_to_r2
    sb = get_supabase_client()

    raw_text_r2_key = None
    if raw_text:
        try:
            raw_text_r2_key = upload_text_to_r2(raw_text, pdf_filename, "vault-raw-text", agency_id)
        except Exception as e:
            logger.error(f"[VaultKnowledge] Failed to upload raw_text to R2: {e}")

    record = {
        "destination": parsed_data.get("destination", ""),
        "sub_destinations": parsed_data.get("sub_destinations", []),
        "currency": parsed_data.get("currency", "INR"),
        "total_price": parsed_data.get("total_price"),
        "duration_days": parsed_data.get("duration_days"),
        "overview": parsed_data.get("overview", ""),
        "cover_image_url": parsed_data.get("cover_image_url", ""),
        "pdf_filename": pdf_filename,
        "pdf_url": pdf_url,
        "raw_text": None,
        "raw_text_r2_key": raw_text_r2_key,
        "extraction_version": extraction_version,
        "source_pdf_hash": pdf_hash,
        "parsed_data": json.dumps(parsed_data),
        "extra_sections": json.dumps(parsed_data.get("extra_sections", {})),
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if agency_id:
        record["agency_id"] = agency_id
    if user_id:
        record["user_id"] = user_id

    if not sb:
        logger.warning("[VaultKnowledge] No Supabase client — package not persisted to DB.")
        return None

    try:
        # Check for existing record with same hash for same agent
        query = sb.table("vault_packages").select("id").eq("source_pdf_hash", pdf_hash)
        if agency_id:
            query = query.eq("agency_id", agency_id)
        existing = query.execute()

        if existing.data:
            # Update existing
            pkg_id = existing.data[0]["id"]
            sb.table("vault_packages").update(record).eq("id", pkg_id).execute()
            logger.info(f"[VaultKnowledge] Updated existing vault package id={pkg_id}")
            return {"id": pkg_id, **record}
        else:
            # Mark previous versions of the same file for the same agency as superseded
            try:
                prev_query = sb.table("vault_packages").select("id").eq("pdf_filename", pdf_filename).eq("status", "active")
                if agency_id:
                    prev_query = prev_query.eq("agency_id", agency_id)
                prev_res = prev_query.execute()
                if prev_res.data:
                    for prev_pkg in prev_res.data:
                        sb.table("vault_packages").update({"status": "superseded"}).eq("id", prev_pkg["id"]).execute()
                        logger.info(f"[VaultKnowledge] Superseded old vault package version id={prev_pkg['id']}")
            except Exception as e:
                logger.error(f"[VaultKnowledge] Failed to supersede old versions: {e}")

            # Insert new
            res = sb.table("vault_packages").insert(record).execute()
            if res.data:
                logger.info(f"[VaultKnowledge] Saved new vault package: {res.data[0].get('id')}")
                return res.data[0]
    except Exception as e:
        logger.error(f"[VaultKnowledge] Failed to save vault package: {e}")

    return None


def list_vault_packages(
    agency_id: Optional[str] = None,
    user_id: Optional[str] = None,
    destination_filter: Optional[str] = None,
    budget: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    List vault packages for an agent, optionally filtered by destination.
    If budget is provided, apply ±30% budget-match filter (only return packages
    whose total_price is within 70%-130% of the requested budget).
    """
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()

    if not sb:
        return []

    try:
        query = sb.table("vault_packages").select("*").eq("status", "active")
        if agency_id:
            query = query.eq("agency_id", agency_id)
        if destination_filter:
            query = query.ilike("destination", f"%{destination_filter}%")

        res = query.order("created_at", desc=True).execute()
        packages = res.data or []

        # Budget-match filtering: ±30%
        if budget and budget > 0:
            low = budget * (1 - BUDGET_MATCH_TOLERANCE)
            high = budget * (1 + BUDGET_MATCH_TOLERANCE)
            matched = [
                p for p in packages
                if p.get("total_price") is not None and low <= float(p["total_price"]) <= high
            ]
            # If no budget-matched packages found, return all packages for that destination
            packages = matched if matched else packages

        # Deserialize JSONB strings if needed
        for pkg in packages:
            if isinstance(pkg.get("parsed_data"), str):
                try:
                    pkg["parsed_data"] = json.loads(pkg["parsed_data"])
                except Exception:
                    pass
            if isinstance(pkg.get("extra_sections"), str):
                try:
                    pkg["extra_sections"] = json.loads(pkg["extra_sections"])
                except Exception:
                    pass
            if pkg.get("raw_text") is None and pkg.get("raw_text_r2_key"):
                try:
                    from src.services.r2_storage_service import get_text_from_r2
                    pkg["raw_text"] = get_text_from_r2(pkg["raw_text_r2_key"])
                except Exception:
                    pass

        return packages
    except Exception as e:
        logger.error(f"[VaultKnowledge] Failed to list vault packages: {e}")
        return []


def get_vault_package(pkg_id: str, agency_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()
    if not sb:
        return None
    try:
        query = sb.table("vault_packages").select("*").eq("id", pkg_id)
        if agency_id:
            query = query.eq("agency_id", agency_id)
        res = query.maybe_single().execute()
        pkg = res.data
        if pkg:
            if isinstance(pkg.get("parsed_data"), str):
                try:
                    pkg["parsed_data"] = json.loads(pkg["parsed_data"])
                except Exception:
                    pass
            if isinstance(pkg.get("extra_sections"), str):
                try:
                    pkg["extra_sections"] = json.loads(pkg["extra_sections"])
                except Exception:
                    pass
            if pkg.get("raw_text") is None and pkg.get("raw_text_r2_key"):
                try:
                    from src.services.r2_storage_service import get_text_from_r2
                    pkg["raw_text"] = get_text_from_r2(pkg["raw_text_r2_key"])
                except Exception:
                    pass
        return pkg
    except Exception as e:
        logger.error(f"[VaultKnowledge] get_vault_package failed: {e}")
        return None


def delete_vault_package(pkg_id: str, agency_id: Optional[str] = None) -> bool:
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()
    if not sb:
        return False
    try:
        query = sb.table("vault_packages").update({"status": "deleted"}).eq("id", pkg_id)
        if agency_id:
            query = query.eq("agency_id", agency_id)
        res = query.execute()
        if not res.data:
            sb.table("vault_packages").update({"status": "deleted"}).eq("id", pkg_id).execute()
        try:
            sb.table("supplier_pdfs").delete().eq("id", pkg_id).execute()
        except Exception:
            pass
        return True
    except Exception as e:
        logger.error(f"[VaultKnowledge] delete_vault_package failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# DESTINATION KNOWLEDGE — Accumulation & Retrieval
# ─────────────────────────────────────────────────────────────────────────────

SECTION_TITLES = {
    "what_to_pack": "What to Pack",
    "visa_guidelines": "Visa & Passport Guidelines",
    "inclusions": "Package Inclusions",
    "exclusions": "Exclusions",
    "important_notes": "Important Notes",
    "damages": "Damage / Cancellation Policy",
    "cancellation_policy": "Cancellation Policy",
    "dos_and_donts": "Do's and Don'ts",
    "terms_of_payment": "Terms of Payment",
}


def _merge_content(existing: str, new_content: str) -> str:
    """
    Merges two text content blocks by splitting into lines and deduplicating.
    New unique lines are appended to the existing content.
    """
    existing_lines = set(
        line.strip().lower()
        for line in existing.splitlines()
        if line.strip() and len(line.strip()) > 3
    )
    new_lines = [
        line.strip()
        for line in new_content.splitlines()
        if line.strip() and len(line.strip()) > 3 and line.strip().lower() not in existing_lines
    ]
    if not new_lines:
        return existing  # Nothing new to add
    return existing.rstrip() + "\n" + "\n".join(new_lines)


def accumulate_destination_knowledge(
    destination: str,
    extra_sections: Dict[str, str],
    agency_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> bool:
    """
    For each static section extracted from a PDF, accumulate it into the
    destination_knowledge table. If a section already exists, merge unique
    bullet points/lines — do NOT duplicate.

    This is the core "learning" mechanism: the 2nd PDF for Ladakh only adds
    NEW items to What to Pack, not duplicates.
    """
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()

    if not sb or not extra_sections or not destination:
        logger.info("[VaultKnowledge] Skipping knowledge accumulation (no client or sections).")
        return False

    dest_lower = destination.strip().lower()
    success_count = 0

    for section_type, content in extra_sections.items():
        if not content or not content.strip():
            continue

        title = SECTION_TITLES.get(section_type, section_type.replace("_", " ").title())

        try:
            # Try to find existing record
            query = (
                sb.table("destination_knowledge")
                .select("id, content, source_count")
                .eq("destination", dest_lower)
                .eq("section_type", section_type)
            )
            if agency_id:
                query = query.eq("agency_id", agency_id)
            if user_id:
                query = query.eq("user_id", user_id)

            res = query.maybe_single().execute()
            existing = res.data

            if existing:
                # Merge content
                merged = _merge_content(existing["content"], content)
                update_data = {
                    "content": merged,
                    "source_count": (existing.get("source_count") or 1) + 1,
                    "updated_at": datetime.utcnow().isoformat(),
                }
                sb.table("destination_knowledge").update(update_data).eq("id", existing["id"]).execute()
                logger.info(f"[VaultKnowledge] Merged '{section_type}' for '{dest_lower}' (source #{update_data['source_count']})")
            else:
                # Insert new knowledge
                record = {
                    "destination": dest_lower,
                    "section_type": section_type,
                    "section_title": title,
                    "content": content.strip(),
                    "source_count": 1,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
                if agency_id:
                    record["agency_id"] = agency_id
                if user_id:
                    record["user_id"] = user_id
                sb.table("destination_knowledge").insert(record).execute()
                logger.info(f"[VaultKnowledge] Created new knowledge '{section_type}' for '{dest_lower}'")

            success_count += 1

        except Exception as e:
            logger.error(f"[VaultKnowledge] Failed to accumulate '{section_type}': {e}")

    return success_count > 0


def get_destination_knowledge(
    destination: str,
    agency_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve all accumulated knowledge for a destination.
    Returns a dict: { section_type: { title, content, source_count } }
    Used to auto-fill proposal wizard Steps 4.
    """
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()

    if not sb or not destination:
        return {}

    dest_lower = destination.strip().lower()
    result = {}

    try:
        query = sb.table("destination_knowledge").select("*").ilike("destination", f"%{dest_lower}%")
        if agency_id:
            query = query.eq("agency_id", agency_id)
        if user_id:
            query = query.eq("user_id", user_id)

        res = query.execute()
        for row in (res.data or []):
            result[row["section_type"]] = {
                "title": row["section_title"],
                "content": row["content"],
                "source_count": row.get("source_count", 1),
            }
    except Exception as e:
        logger.error(f"[VaultKnowledge] get_destination_knowledge failed: {e}")

    return result
