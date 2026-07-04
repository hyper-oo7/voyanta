from fastapi import APIRouter, Depends, HTTPException
from typing import Any
import logging

from src.models.api_models import ParseItineraryInput
from src.core.security import verify_token, verify_token_optional
from src.services.ai_service import extract_itinerary

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/parse-itinerary")
async def parse_itinerary(input: ParseItineraryInput, user: Any = Depends(verify_token_optional)):
    try:
        return await extract_itinerary(input.text)
    except Exception as e:
        logger.exception("AI itinerary parsing failed")
        raise HTTPException(status_code=500, detail=str(e))
