from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from typing import Any

from src.models.api_models import PDFGenerateRequest
from src.core.security import verify_token
from src.services.pdf_service import generate_pdf_from_proposal
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf")

@router.post("/generate")
async def pdf_generate(request: PDFGenerateRequest, user: Any = Depends(verify_token)):
    proposal_id = request.proposal_id
    if not proposal_id:
        raise HTTPException(status_code=400, detail="Missing proposal ID")

    try:
        pdf_bytes = await generate_pdf_from_proposal(proposal_id)
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf",
            headers={'Content-Disposition': f'attachment; filename="proposal-{proposal_id}.pdf"'}
        )
    except Exception as e:
        logger.exception("PDF route failed")
        raise HTTPException(status_code=500, detail=str(e))
