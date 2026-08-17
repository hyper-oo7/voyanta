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
    sb: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    """
    Persist a parsed vault package to Supabase.
    Dedup: if the same PDF (by hash) was already saved for this agent, update it.
    """
    from src.services.supabase_client import get_supabase_client
    from src.services.r2_storage_service import upload_text_to_r2
    if not sb:
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
    def _schedule_summary_task(package_id: str):
        if not package_id:
            return
        text_source = raw_text or parsed_data.get("overview") or json.dumps(parsed_data.get("days", []))
        if text_source and len(text_source) > 30:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                loop.create_task(_generate_and_store_doc_summary(
                    document_id=package_id,
                    agency_id=agency_id or "global",
                    document_text=text_source,
                    table_name="vault_packages",
                ))
            except RuntimeError:
                pass
            except Exception as e:
                logger.debug(f"[VaultKnowledge] Summary schedule skipped: {e}")

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
            _schedule_summary_task(pkg_id)
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
                saved_id = res.data[0].get("id")
                logger.info(f"[VaultKnowledge] Saved new vault package: {saved_id}")
                _schedule_summary_task(saved_id)
                return res.data[0]
    except Exception as e:
        logger.error(f"[VaultKnowledge] Failed to save vault package: {e}")

    return None


async def _generate_and_store_doc_summary(
    document_id: str,
    agency_id: str,
    document_text: str,
    table_name: str = "vault_packages",
) -> None:
    """Background task: generate doc-level summary embedding for Document Summary routing."""
    try:
        from src.services.ai_client import call_llm
        from src.services.embedder import embedder
        from src.services.vector_store import vector_store

        summary = await call_llm(
            prompt=(
                f"Summarize this travel supplier document in 2-3 concise sentences. "
                f"Include destination, trip duration, star category, key attractions, and price range if visible:\n\n"
                f"{document_text[:3500]}"
            ),
            system_prompt="You are a travel document indexer. Produce a concise, factual summary for search routing.",
            temperature=0.0,
            max_tokens=150,
        )
        if summary and len(summary.strip()) > 10:
            summary_emb = embedder.embed_text(summary.strip())
            vector_store.store_document_summary(
                document_id=document_id,
                agency_id=agency_id,
                summary_text=summary.strip(),
                summary_embedding=summary_emb,
                table_name=table_name,
            )
            logger.info(f"[VaultKnowledge] Stored document summary embedding for id={document_id}")
    except Exception as e:
        logger.debug(f"[VaultKnowledge] Background doc summary generation skipped: {e}")


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


def update_vault_package(pkg_id: str, updated_data: Dict[str, Any], agency_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    from src.services.supabase_client import get_supabase_client
    from datetime import datetime
    sb = get_supabase_client()
    if not sb:
        return None
    try:
        fields = {}
        for key in ["destination", "total_price", "currency", "duration_days", "overview", "cover_image_url", "package_type"]:
            if key in updated_data and updated_data[key] is not None:
                fields[key] = updated_data[key]
        
        if "parsed_data" in updated_data:
            val = updated_data["parsed_data"]
            fields["parsed_data"] = json.dumps(val) if isinstance(val, (dict, list)) else val
        elif any(k in updated_data for k in ["title", "days", "sub_destinations", "inclusions", "exclusions", "hotels", "activities"]):
            # Also update parsed_data object if top-level fields were edited
            existing = get_vault_package(pkg_id, agency_id)
            parsed = existing.get("parsed_data", {}) if existing else {}
            if isinstance(parsed, str):
                try: parsed = json.loads(parsed)
                except Exception: parsed = {}
            if not isinstance(parsed, dict): parsed = {}
            for k in ["title", "days", "sub_destinations", "inclusions", "exclusions", "hotels", "activities", "overview", "total_price", "currency", "duration_days", "cover_image_url", "extra_sections"]:
                if k in updated_data:
                    parsed[k] = updated_data[k]
            fields["parsed_data"] = json.dumps(parsed)

        if "extra_sections" in updated_data:
            val = updated_data["extra_sections"]
            fields["extra_sections"] = json.dumps(val) if isinstance(val, dict) else val

        fields["updated_at"] = datetime.utcnow().isoformat()

        query = sb.table("vault_packages").update(fields).eq("id", pkg_id)
        if agency_id:
            query = query.eq("agency_id", agency_id)
        res = query.execute()
        if res.data:
            pkg = res.data[0]
            if isinstance(pkg.get("parsed_data"), str):
                try: pkg["parsed_data"] = json.loads(pkg["parsed_data"])
                except Exception: pass
            if isinstance(pkg.get("extra_sections"), str):
                try: pkg["extra_sections"] = json.loads(pkg["extra_sections"])
                except Exception: pass
            return pkg
        # Fallback to update by ID without agency_id check if query returned empty
        res = sb.table("vault_packages").update(fields).eq("id", pkg_id).execute()
        if res.data:
            pkg = res.data[0]
            if isinstance(pkg.get("parsed_data"), str):
                try: pkg["parsed_data"] = json.loads(pkg["parsed_data"])
                except Exception: pass
            if isinstance(pkg.get("extra_sections"), str):
                try: pkg["extra_sections"] = json.loads(pkg["extra_sections"])
                except Exception: pass
            return pkg
        return None
    except Exception as e:
        logger.error(f"[VaultKnowledge] update_vault_package failed: {e}")
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
    Queries both destination_knowledge and agency_packing_rules tables for agency isolation (Rule 5).
    """
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()

    if not sb or not destination:
        return {}

    dest_lower = destination.strip().lower()
    result = {}

    try:
        # Scope by agency_id only — user_id is an audit field, not a row-level scope key.
        # Filtering by both agency_id AND user_id creates a double-AND that silently returns
        # nothing for rows stored with only agency_id set (the common case).
        query = sb.table("destination_knowledge").select("*").ilike("destination", f"%{dest_lower}%")
        if agency_id:
            query = query.eq("agency_id", agency_id)
        # NOTE: do NOT filter by user_id here — knowledge is agency-scoped, not per-user.

        res = query.execute()
        for row in (res.data or []):
            result[row["section_type"]] = {
                "title": row.get("section_title") or row["section_type"].replace('_', ' ').title(),
                "content": row["content"],
                "source_count": row.get("source_count", 1),
            }

        if agency_id:
            try:
                res_packing = sb.table("agency_packing_rules").select("*").eq("agency_id", agency_id).execute()
                for rule in (res_packing.data or []):
                    kw = (rule.get("destination_keyword") or "").lower().strip()
                    if kw and (dest_lower in kw or kw in dest_lower):
                        stype = rule.get("section_type") or "what_to_pack"
                        if stype not in result or not result[stype].get("content"):
                            result[stype] = {
                                "title": rule.get("section_title") or ("What to Pack" if stype == "what_to_pack" else stype.replace('_', ' ').title()),
                                "content": rule.get("content", ""),
                                "source_count": 1,
                            }
            except Exception as e_pack:
                logger.error(f"[VaultKnowledge] agency_packing_rules query failed: {e_pack}")
    except Exception as e:
        logger.error(f"[VaultKnowledge] get_destination_knowledge failed: {e}")

    return result


def perform_pdf_delta_sync(
    extracted_pkg: Dict[str, Any],
    agency_id: Optional[str] = "global",
    sb: Any = None
) -> Dict[str, Any]:
    """
    Delta Extraction Engine:
    Compares newly extracted entities against existing Vault & Master Library inventory.
    Identifies brand-new hotels, activities, and attractions, appends them to DB,
    and returns a transparent delta summary.
    """
    delta_summary = {
        "new_hotels": [],
        "new_activities": [],
        "updated_hotels": [],
        "updated_activities": [],
        "total_new_items": 0
    }

    if not sb:
        from src.services.supabase_client import get_supabase_client
        sb = get_supabase_client()

    new_hotels = extracted_pkg.get("hotels", [])
    new_activities = extracted_pkg.get("activities", [])
    destination = extracted_pkg.get("destination", "")

    # 1. Delta check for Hotels
    existing_hotels = []
    if sb:
        try:
            h_query = sb.table("hotels").select("id, name, location, price_per_night")
            if agency_id and agency_id != "global":
                h_query = h_query.eq("agency_id", agency_id)
            h_res = h_query.execute()
            if h_res.data:
                existing_hotels = h_res.data
        except Exception as e:
            logger.error(f"[DeltaSync] Error fetching existing hotels: {e}")

    existing_h_names = {str(h.get("name") or "").strip().lower() for h in existing_hotels if h.get("name")}

    for h in new_hotels:
        if not isinstance(h, dict):
            continue
        h_name = (h.get("name") or "").strip()
        if not h_name:
            continue

        normalized_name = h_name.lower()
        if normalized_name not in existing_h_names:
            # Brand new hotel found!
            delta_summary["new_hotels"].append(h_name)
            existing_h_names.add(normalized_name)
            delta_summary["total_new_items"] += 1

            if sb:
                try:
                    hotel_record = {
                        "name": h_name,
                        "location": h.get("location") or destination or "Imported Location",
                        "price_per_night": float(h.get("price_per_night") or h.get("rate") or 5000),
                        "meal_type": h.get("meal_plan") or h.get("meal_type") or "CP (Breakfast)",
                        "room_type": h.get("room_type") or "Deluxe Room",
                        "category": h.get("category") or "4 Star",
                        "rating": float(h.get("rating") or 4.5),
                        "amenities": h.get("amenities") if isinstance(h.get("amenities"), list) else ["WiFi", "Room Service"],
                        "currency": h.get("currency") or "INR",
                        "image_url": h.get("image_url") or h.get("cover_image") or "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"
                    }
                    if agency_id:
                        hotel_record["agency_id"] = agency_id
                    sb.table("hotels").insert(hotel_record).execute()
                    logger.info(f"[DeltaSync] Appended NEW hotel to DB: {h_name}")
                except Exception as ins_err:
                    logger.error(f"[DeltaSync] Failed to insert new hotel {h_name}: {ins_err}")
        else:
            delta_summary["updated_hotels"].append(h_name)

    # 2. Delta check for Activities & Attractions
    existing_activities = []
    if sb:
        try:
            a_query = sb.table("activities").select("id, name, location, price")
            if agency_id and agency_id != "global":
                a_query = a_query.eq("agency_id", agency_id)
            a_res = a_query.execute()
            if a_res.data:
                existing_activities = a_res.data
        except Exception as e:
            logger.error(f"[DeltaSync] Error fetching existing activities: {e}")

    existing_act_names = {str(a.get("name") or "").strip().lower() for a in existing_activities if a.get("name")}

    all_extracted_acts = list(new_activities)
    for day in extracted_pkg.get("days", []):
        if isinstance(day, dict):
            for d_act in day.get("activities", []):
                if isinstance(d_act, dict) and d_act not in all_extracted_acts:
                    all_extracted_acts.append(d_act)
                elif isinstance(d_act, str):
                    all_extracted_acts.append({"name": d_act})

    for act in all_extracted_acts:
        if not isinstance(act, dict):
            continue
        act_name = (act.get("name") or "").strip()
        if not act_name:
            continue

        normalized_act = act_name.lower()
        if normalized_act not in existing_act_names:
            # Brand new activity found!
            delta_summary["new_activities"].append(act_name)
            existing_act_names.add(normalized_act)
            delta_summary["total_new_items"] += 1

            if sb:
                try:
                    act_record = {
                        "name": act_name,
                        "location": act.get("location") or destination or "Imported Location",
                        "type": act.get("type") or "Sightseeing",
                        "duration_hours": float(act.get("duration_hours") or 4),
                        "price": float(act.get("price") or act.get("rate") or 3500),
                        "currency": act.get("currency") or "INR",
                        "description": act.get("description") or act.get("details") or "",
                        "image_url": act.get("image_url") or "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800"
                    }
                    if agency_id:
                        act_record["agency_id"] = agency_id
                    sb.table("activities").insert(act_record).execute()
                    logger.info(f"[DeltaSync] Appended NEW activity to DB: {act_name}")
                except Exception as ins_err:
                    logger.error(f"[DeltaSync] Failed to insert new activity {act_name}: {ins_err}")
        else:
            delta_summary["updated_activities"].append(act_name)

    logger.info(
        f"[DeltaSync] Complete. Discovered {delta_summary['total_new_items']} new items "
        f"({len(delta_summary['new_hotels'])} hotels, {len(delta_summary['new_activities'])} activities)."
    )
    return delta_summary
