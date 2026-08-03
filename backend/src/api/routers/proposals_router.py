"""
API Router for proposal generation, template rendering, and saving.
Exposes endpoints for generating RAG proposals, rendering HTML templates, saving proposal drafts, and querying proposal records.
"""
import uuid
import asyncio
import logging
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks

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
from src.services.chunker import TravelDocumentChunker
from src.services.embedder import embedder
from src.services.vector_store import vector_store

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


def _embed_proposal_in_background(proposal_id: str, agency_id: str, sb: Any) -> None:
    """
    Background task: chunks and embeds finalized proposal content into the RAG
    vector store so future proposal generation benefits from real past trips.
    """
    try:
        resp = sb.table("proposals").select("*").eq("id", proposal_id).single().execute()
        if not resp.data:
            logger.warning(f"[ProposalEmbed] Proposal {proposal_id} not found — skipping embed")
            return

        data = resp.data
        content = data.get("content") or {}
        destination = data.get("destination") or (content.get("destination") if isinstance(content, dict) else "") or "General"

        # Build a plain-text representation from day descriptions
        lines = [
            f"Proposal: {data.get('title', '')}",
            f"Destination: {destination}",
            f"Duration: {data.get('duration_days', '')} days",
        ]
        if isinstance(content, dict):
            for day in content.get("days", []):
                lines.append(f"\nDay {day.get('day_number', '')}: {day.get('title', '')}")
                lines.append(day.get("description", ""))
                for act in day.get("activities", []):
                    act_name = act.get("name", "") if isinstance(act, dict) else str(act)
                    lines.append(f"  - {act_name}")
                for hotel in day.get("hotels", []):
                    h_name = hotel.get("name", "") if isinstance(hotel, dict) else str(hotel)
                    lines.append(f"  Hotel: {h_name}")

        raw_text = "\n".join(filter(None, lines))
        if len(raw_text) < 50:
            logger.info(f"[ProposalEmbed] Proposal {proposal_id} too short to embed — skipping")
            return

        chunker_svc = TravelDocumentChunker()
        chunks = chunker_svc.chunk_text(raw_text, metadata={
            "document_name": data.get("title", f"Proposal {proposal_id}"),
            "destination": destination,
            "agency_id": agency_id,
            "source_type": "proposal",
            "proposal_id": proposal_id,
        })

        if not chunks:
            return

        chunk_texts = [c["content"] for c in chunks]
        embeddings = embedder.embed_texts(chunk_texts)
        stored = vector_store.store_chunks(
            agency_id=agency_id,
            document_id=proposal_id,
            chunks=chunks,
            embeddings=embeddings,
        )
        logger.info(f"[ProposalEmbed] Indexed {stored} chunks for finalized proposal '{proposal_id}' (dest={destination})")
    except Exception as e:
        logger.error(f"[ProposalEmbed] Background embedding failed for proposal {proposal_id}: {e}")


@router.post("/{proposal_id}/finalize")
async def finalize_proposal(
    proposal_id: str,
    background_tasks: BackgroundTasks,
    agency_id: str = Query("global"),
):
    """
    Marks proposal as finalized and triggers async RAG embedding.
    Call this endpoint whenever a proposal is sent / approved.
    Embedding runs in the background — response is immediate.
    """
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        sb.table("proposals").update({"status": "finalized"}).eq("id", proposal_id).execute()
    except Exception as e:
        logger.error(f"[ProposalsRouter] Failed to update status for {proposal_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Finalize failed: {e}")

    # Kick off background embedding — non-blocking
    background_tasks.add_task(_embed_proposal_in_background, proposal_id, agency_id, sb)
    
    # 4A: Style Fingerprint Auto-Rebuild
    from src.services.proposal_style_service import rebuild_style_profile
    background_tasks.add_task(rebuild_style_profile, agency_id)

    return {
        "status": "finalized",
        "proposal_id": proposal_id,
        "message": "Proposal finalized. Content is being indexed into vault knowledge in the background."
    }


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


