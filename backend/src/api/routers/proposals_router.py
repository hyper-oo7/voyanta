"""
API Router for proposal generation, template rendering, and saving.
Exposes endpoints for generating RAG proposals, rendering HTML templates, saving proposal drafts, and querying proposal records.
"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from src.models.schemas import (
    ProposalGenerateRequest,
    ProposalSaveRequest,
    ProposalSaveResponse,
    GeneratedProposal,
)
from src.services.proposal_generator import proposal_generator
from src.services.template_renderer import template_renderer
from src.services.image_service import image_service
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proposals", tags=["proposals"])

def get_supabase():
    return get_supabase_client()

@router.post("/generate", response_model=GeneratedProposal)
async def generate_proposal(request: ProposalGenerateRequest):
    try:
        sb = get_supabase()
        agency_context = ""
        if sb:
            try:
                agency_resp = sb.table("agencies").select("*").eq("id", request.agency_id).single().execute()
                agency = agency_resp.data or {}
                agency_context = agency.get("brand_voice_prompt", "")
            except Exception as e:
                logger.info(f"[ProposalsRouter] Agency query notice: {e}")
        
        proposal = await proposal_generator.generate_async(
            request=request,
            agency_context=agency_context,
        )
        
        if request.include_images:
            activity_names = []
            for day in proposal.day_plans:
                activity_names.extend(day.activities)
            images = await image_service.get_destination_images(
                destination=request.destination,
                activities=list(set(activity_names))[:5],
            )
            proposal.images = images
        
        return proposal
    except Exception as e:
        logger.error(f"[ProposalsRouter] Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Proposal generation failed: {str(e)}")

@router.post("/generate-with-template")
async def generate_proposal_with_template(request: ProposalGenerateRequest):
    proposal = await generate_proposal(request)
    rendered = template_renderer.render(
        proposal=proposal,
        template_id=request.template_id,
        agency_id=request.agency_id,
        images=proposal.images,
    )
    return {
        "proposal": proposal,
        "rendered_html": rendered["html"],
        "template_used": rendered.get("template_name"),
        "is_fallback": rendered.get("is_fallback", False),
    }

@router.post("/save", response_model=ProposalSaveResponse)
async def save_proposal(request: ProposalSaveRequest):
    proposal_id = str(uuid.uuid4())
    sb = get_supabase()
    if sb:
        try:
            sb.table("proposals").insert({
                "id": proposal_id,
                "agency_id": request.agency_id,
                "client_id": request.client_id,
                "template_id": request.template_id,
                "title": request.generated_proposal.title,
                "destination": request.generated_proposal.destination,
                "duration_days": request.generated_proposal.duration_days,
                "content": request.generated_proposal.model_dump(),
                "status": request.status.value,
            }).execute()
        except Exception as e:
            logger.error(f"[ProposalsRouter] Error saving proposal record: {e}")
            
    public_url = f"/p/{proposal_id}"
    return ProposalSaveResponse(
        proposal_id=proposal_id,
        public_url=public_url,
        status="saved",
    )

@router.get("/{proposal_id}")
async def get_proposal(proposal_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=404, detail="Supabase unavailable")
    try:
        resp = sb.table("proposals").select("*").eq("id", proposal_id).single().execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Proposal not found")
        return resp.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Proposal not found: {e}")

@router.get("/")
async def list_proposals(agency_id: str = Query("global"), client_id: Optional[str] = Query(None)):
    sb = get_supabase()
    if not sb:
        return {"proposals": []}
    try:
        query = sb.table("proposals").select("*").eq("agency_id", agency_id)
        if client_id:
            query = query.eq("client_id", client_id)
        resp = query.order("created_at", desc=True).execute()
        return {"proposals": resp.data or []}
    except Exception as e:
        logger.error(f"[ProposalsRouter] Error listing proposals: {e}")
        return {"proposals": []}
