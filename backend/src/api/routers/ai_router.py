from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict
from pydantic import BaseModel
import logging

from src.models.api_models import ParseItineraryInput
from src.core.security import verify_token, verify_token_optional
from src.services.ai_service import extract_itinerary, translate_proposal_content

logger = logging.getLogger(__name__)
router = APIRouter()

class TranslateProposalInput(BaseModel):
    proposal: Dict[str, Any]
    target_lang: str

@router.post("/parse-itinerary")
async def parse_itinerary(input: ParseItineraryInput, user: Any = Depends(verify_token_optional)):
    try:
        return await extract_itinerary(input.text)
    except Exception as e:
        logger.exception("AI itinerary parsing failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/translate-proposal")
async def translate_proposal(input: TranslateProposalInput, user: Any = Depends(verify_token_optional)):
    try:
        translated = await translate_proposal_content(input.proposal, input.target_lang)
        return {"success": True, "translated_proposal": translated}
    except Exception as e:
        logger.exception("AI proposal translation failed")
        return {"success": False, "translated_proposal": input.proposal, "error": str(e)}

