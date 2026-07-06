from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from typing import Any
import logging

from src.models.api_models import PPTGenerateRequest
from src.core.security import verify_token
from src.services.ppt_service import generate_ppt_from_proposal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ppt")

@router.post("/generate")
async def ppt_generate(request: PPTGenerateRequest, user: Any = Depends(verify_token)):
    payload = request.model_dump()
    try:
        proposal = payload.get("proposal", {})
        items = payload.get("items", [])
        
        ppt_bytes = generate_ppt_from_proposal(proposal, items)
        
        proposal_name = proposal.get("name", "proposal")
        safe = ''.join(ch if ch.isalnum() or ch in ('.', '_', '-') else '-' for ch in proposal_name)
        
        return Response(
            content=ppt_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f"attachment; filename=\"{safe}.pptx\""}
        )
    except Exception as e:
        logger.exception("PPT route failed")
        raise HTTPException(status_code=500, detail=str(e))
