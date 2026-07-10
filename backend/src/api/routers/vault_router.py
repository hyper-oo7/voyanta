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


@router.get("/packages/{pkg_id}")
async def get_package(pkg_id: str, user: Any = Depends(verify_token_optional)):
    """Get a single vault package by ID."""
    agency_id, _ = _extract_user_context(user)
    pkg = get_vault_package(pkg_id, agency_id=agency_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Vault package not found")
    return JSONResponse(content={"status": "success", "package": pkg})


@router.delete("/packages/{pkg_id}")
async def delete_package(pkg_id: str, user: Any = Depends(verify_token_optional)):
    """Soft-delete a vault package (status → 'deleted')."""
    agency_id, _ = _extract_user_context(user)
    ok = delete_vault_package(pkg_id, agency_id=agency_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete vault package")
    return JSONResponse(content={"status": "success", "message": "Package deleted"})


# ─────────────────────────────────────────────────────────────────────────────
# DESTINATION KNOWLEDGE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/knowledge")
async def get_knowledge(
    destination: str = Query(..., description="Destination name e.g. Ladakh"),
    user: Any = Depends(verify_token_optional),
):
    """
    Get accumulated knowledge sections for a destination.
    Used by Step4Branding to auto-fill inclusions, exclusions, what to pack, etc.
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
