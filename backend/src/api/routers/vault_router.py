"""
vault_router.py — REST API for Vault V2
Endpoints for managing vault packages and destination knowledge.
"""
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.core.security import verify_token, verify_token_optional
from src.services.vault_knowledge_service import (
    list_vault_packages,
    get_vault_package,
    update_vault_package,
    delete_vault_package,
    get_destination_knowledge,
    accumulate_destination_knowledge,
    SECTION_TITLES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vault", tags=["Vault V2"])


def _extract_user_context(user: Any):
    """Extract agency_id and user_id from JWT claims."""
    agency_id = None
    user_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )
        user_id = user.get("sub") or user.get("id")
    return agency_id, user_id


class KnowledgeUpsertRequest(BaseModel):
    destination: str
    section_type: str
    section_title: Optional[str] = None
    content: str


# ─────────────────────────────────────────────────────────────────────────────
# VAULT PACKAGES
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/packages")
async def list_packages(
    destination: str = Query("", description="Filter by destination name"),
    budget: float = Query(0, description="Budget for ±30% match filtering"),
    user: Any = Depends(verify_token_optional),
):
    """
    List vault packages for the authenticated agent.
    If budget is provided, only returns packages whose total_price is within ±30%.
    E.g. budget=20000 returns packages priced 14,000–26,000.
    """
    agency_id, user_id = _extract_user_context(user)
    packages = list_vault_packages(
        agency_id=agency_id,
        user_id=user_id,
        destination_filter=destination or None,
        budget=budget if budget > 0 else None,
    )
    return JSONResponse(content={"status": "success", "packages": packages, "count": len(packages)})


@router.get("/destination-confidence")
async def get_destination_confidence(
    destination: str = Query(..., description="Destination name to score"),
    user: Any = Depends(verify_token_optional)
):
    """
    4B: Destination Confidence Scoring
    Calculates the 'knowledge richness' for a destination based on uploaded PDFs and finalized proposals.
    """
    agency_id, user_id = _extract_user_context(user)
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()
    
    if not sb:
        return JSONResponse(content={"status": "success", "confidence_score": 0, "pdfs": 0, "proposals": 0})
        
    try:
        # Count PDFs in vault_packages for this destination
        pkg_resp = sb.table("vault_packages").select("id", count="exact").eq("agency_id", agency_id).ilike("destination", f"%{destination}%").execute()
        pdf_count = pkg_resp.count or 0
        
        # Count finalized proposals for this destination
        prop_resp = sb.table("proposals").select("id", count="exact").eq("agency_id", agency_id).eq("status", "finalized").ilike("destination", f"%{destination}%").execute()
        proposal_count = prop_resp.count or 0
        
        # Calculate confidence score (e.g. max 100%, 10% per PDF, 5% per proposal)
        score = min(100, (pdf_count * 10) + (proposal_count * 5))
        
        return JSONResponse(content={
            "status": "success",
            "destination": destination,
            "confidence_score": score,
            "pdfs": pdf_count,
            "proposals": proposal_count,
            "message": f"{score}% confidence ({pdf_count} PDFs + {proposal_count} proposals)"
        })
    except Exception as e:
        logger.error(f"[VaultRouter] Error calculating destination confidence: {e}")
        return JSONResponse(content={"status": "error", "confidence_score": 0, "pdfs": 0, "proposals": 0})

@router.get("/packages/{pkg_id}")
async def get_package(pkg_id: str, user: Any = Depends(verify_token_optional)):
    """Get a single vault package by ID."""
    agency_id, _ = _extract_user_context(user)
    pkg = get_vault_package(pkg_id, agency_id=agency_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Vault package not found")
    return JSONResponse(content={"status": "success", "package": pkg})


class VaultPackageUpdatePayload(BaseModel):
    destination: Optional[str] = None
    total_price: Optional[float] = None
    currency: Optional[str] = None
    duration_days: Optional[int] = None
    overview: Optional[str] = None
    cover_image_url: Optional[str] = None
    parsed_data: Optional[dict] = None
    extra_sections: Optional[dict] = None
    title: Optional[str] = None
    days: Optional[list] = None
    sub_destinations: Optional[list] = None
    inclusions: Optional[list] = None
    exclusions: Optional[list] = None
    hotels: Optional[list] = None
    activities: Optional[list] = None

    class Config:
        extra = "allow"


@router.put("/packages/{pkg_id}")
async def update_package(pkg_id: str, payload: VaultPackageUpdatePayload, user: Any = Depends(verify_token_optional)):
    """Update an existing vault package."""
    agency_id, _ = _extract_user_context(user)
    data = payload.dict(exclude_unset=True)
    pkg = update_vault_package(pkg_id, data, agency_id=agency_id)
    if not pkg:
        raise HTTPException(status_code=500, detail="Failed to update vault package")
    return JSONResponse(content={"status": "success", "package": pkg})


@router.delete("/packages/{pkg_id}")
async def delete_package(pkg_id: str, user: Any = Depends(verify_token_optional)):
    """Soft-delete a vault package (status → 'deleted')."""
    agency_id, _ = _extract_user_context(user)
    ok = delete_vault_package(pkg_id, agency_id=agency_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete vault package")
    return JSONResponse(content={"status": "success", "message": "Package deleted"})


@router.get("/sub-destinations")
async def get_agency_sub_destinations(user: Any = Depends(verify_token_optional)):
    """
    Get all unique sub-destinations extracted from the agency's vault packages.
    """
    agency_id, _ = _extract_user_context(user)
    from src.services.supabase_client import get_supabase_client
    sb = get_supabase_client()
    if not sb:
        return JSONResponse(content={"status": "success", "sub_destinations": []})

    try:
        # Fetch all active packages for this agency
        query = sb.table("vault_packages").select("sub_destinations").eq("status", "active")
        if agency_id:
            query = query.eq("agency_id", agency_id)
        
        res = query.execute()
        packages = res.data or []
        
        # Aggregate and deduplicate sub-destinations
        unique_subs = set()
        for pkg in packages:
            subs = pkg.get("sub_destinations") or []
            if isinstance(subs, str):
                import json
                try:
                    subs = json.loads(subs)
                except:
                    subs = []
            if isinstance(subs, list):
                for s in subs:
                    if isinstance(s, str) and s.strip():
                        unique_subs.add(s.strip().title())
                        
        return JSONResponse(content={"status": "success", "sub_destinations": sorted(list(unique_subs))})
    except Exception as e:
        logger.error(f"[VaultRouter] Error fetching sub-destinations: {e}")
        return JSONResponse(content={"status": "error", "sub_destinations": []}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
# DESTINATION KNOWLEDGE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/knowledge")
@router.get("/match-rules")
async def get_knowledge(
    destination: str = Query(..., description="Destination name e.g. Ladakh"),
    user: Any = Depends(verify_token_optional),
):
    """
    Get accumulated knowledge sections for a destination.
    Used by Step4Branding to auto-fill inclusions, exclusions, what to pack, etc.
    Exposed at both /knowledge and /match-rules for backward/forward compatibility.
    """
    agency_id, user_id = _extract_user_context(user)
    knowledge = get_destination_knowledge(destination, agency_id=agency_id, user_id=user_id)
    return JSONResponse(content={
        "status": "success",
        "destination": destination,
        "knowledge": knowledge,
        "sections_available": list(knowledge.keys()),
    })


@router.post("/knowledge")
async def upsert_knowledge(
    payload: KnowledgeUpsertRequest,
    user: Any = Depends(verify_token),
):
    """
    Manually add or update a knowledge section for a destination.
    Used when agents want to add custom notes for a destination.
    """
    agency_id, user_id = _extract_user_context(user)
    ok = accumulate_destination_knowledge(
        destination=payload.destination,
        extra_sections={payload.section_type: payload.content},
        agency_id=agency_id,
        user_id=user_id,
    )
    return JSONResponse(content={"status": "success" if ok else "partial", "saved": ok})


@router.get("/knowledge/section-types")
async def list_section_types():
    """Returns available section type keys and their human-readable titles."""
    return JSONResponse(content={"section_types": SECTION_TITLES})


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 PDF EXTRACTION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import UploadFile, File

@router.post("/pipeline/extract")
async def extract_pdf_to_blocks(
    file: UploadFile = File(...),
    user: Any = Depends(verify_token_optional),
):
    """
    Phase 1 Pipeline: Process raw PDF into Itinerary Blocks, Attraction Master Records,
    embeddings, and manual review queue items.
    """
    agency_id, _ = _extract_user_context(user)
    pdf_bytes = await file.read()
    
    from src.services.pdf_extraction_pipeline_service import process_pdf_vault_document
    result = await process_pdf_vault_document(
        pdf_bytes=pdf_bytes,
        filename=file.filename or "uploaded_vault_document.pdf",
        agency_id=agency_id or "global"
    )

    return JSONResponse(content=result)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5: RATE CONFLICT RESOLUTION
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/rate-conflicts")
async def get_rate_conflicts(user: Any = Depends(verify_token_optional)):
    """
    Scans vault_packages for hotels with identical names but differing rates.
    """
    agency_id, _ = _extract_user_context(user)
    if not agency_id:
        return JSONResponse(content={"status": "error", "message": "No agency context"}, status_code=400)

    try:
        supabase = get_user_supabase_client()
        res = supabase.table("vault_packages").select("id, filename, parsed_data").eq("agency_id", agency_id).execute()
        
        hotel_rates = {} # name -> [{rate, pkg_id, filename}]
        
        for pkg in res.data:
            parsed = pkg.get("parsed_data", {})
            hotels = parsed.get("hotels", [])
            for h in hotels:
                name = (h.get("name") or "").strip().lower()
                rate = h.get("rate") or h.get("price")
                if name and rate:
                    try:
                        clean_rate = int(str(rate).replace(',', '').replace('₹', '').replace('Rs', '').strip())
                        if name not in hotel_rates:
                            hotel_rates[name] = []
                        hotel_rates[name].append({
                            "rate": clean_rate,
                            "pkg_id": pkg["id"],
                            "filename": pkg.get("filename", "Unknown PDF"),
                            "display_name": h.get("name")
                        })
                    except:
                        pass
        
        conflicts = []
        for name, entries in hotel_rates.items():
            distinct_rates = list(set(e["rate"] for e in entries))
            if len(distinct_rates) > 1:
                conflicts.append({
                    "hotel_name": entries[0]["display_name"],
                    "variations": entries
                })
                
        return JSONResponse(content={"status": "success", "conflicts": conflicts})
    except Exception as e:
        logger.error(f"[Vault RateConflicts] {e}")
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

class ResolveRateConflictInput(BaseModel):
    hotel_name: str
    resolved_rate: int

@router.post("/resolve-rate-conflict")
async def resolve_rate_conflict(input: ResolveRateConflictInput, user: Any = Depends(verify_token_optional)):
    """
    Saves the resolved rate. For simplicity in Phase 5, we create a specialized table entry
    or we just overwrite the vault packages to normalize the rate. 
    Here, we normalize the vault_packages JSON directly.
    """
    agency_id, _ = _extract_user_context(user)
    try:
        supabase = get_user_supabase_client()
        res = supabase.table("vault_packages").select("id, parsed_data").eq("agency_id", agency_id).execute()
        
        updates_made = 0
        target_name = input.hotel_name.strip().lower()
        
        for pkg in res.data:
            parsed = pkg.get("parsed_data", {})
            hotels = parsed.get("hotels", [])
            changed = False
            for h in hotels:
                if (h.get("name") or "").strip().lower() == target_name:
                    h["rate"] = input.resolved_rate
                    h["price"] = input.resolved_rate
                    changed = True
            
            if changed:
                supabase.table("vault_packages").update({"parsed_data": parsed}).eq("id", pkg["id"]).execute()
                updates_made += 1
                
        return JSONResponse(content={"status": "success", "message": f"Resolved rate applied to {updates_made} vault packages."})
    except Exception as e:
        logger.error(f"[Vault ResolveConflict] {e}")
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

