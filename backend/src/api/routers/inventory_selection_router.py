"""
inventory_selection_router.py — Phase 6 Inventory Query Router
================================================================
Exposes deterministic REST endpoints for querying standardized hotels & transfers by
city location and budget band for instant agent 1-click selection.
"""

import logging
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Query, Depends
from fastapi.responses import JSONResponse

from src.core.security import OptionalUser
from src.models.api_models import BaseResponse
from src.services.hotel_transfer_selection_service import query_hotels, query_transfers

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inventory", tags=["Knowledge Vault"])

class HotelQueryResponse(BaseResponse):
    status: str = "success"
    city: str
    count: int
    hotels: List[Dict[str, Any]] = []

class TransferQueryResponse(BaseResponse):
    status: str = "success"
    location: str
    count: int
    transfers: List[Dict[str, Any]] = []

@router.get("/hotels", response_model=HotelQueryResponse, summary="Query standardized inventory hotels by city and budget band")
async def get_hotels_for_city(
    user: OptionalUser,
    city: str = Query(..., description="City or location name e.g. Shillong"),
    budget_band: Optional[str] = Query(None, description="Budget band: low, mid, high"),
    min_price: Optional[float] = Query(None, description="Minimum price bound"),
    max_price: Optional[float] = Query(None, description="Maximum price bound"),
    star_rating: Optional[str] = Query(None, description="Star rating filter e.g. 4_star"),
):
    """
    Deterministic query: hotels WHERE city=Shillong AND price BETWEEN band_min AND band_max.
    Renders instant hotel cards for agent 1-click attachment.
    """
    matched_hotels = query_hotels(
        city=city,
        budget_band=budget_band,
        min_price=min_price,
        max_price=max_price,
        star_rating=star_rating
    )
    return {
        "status": "success",
        "city": city,
        "count": len(matched_hotels),
        "hotels": [h.model_dump() for h in matched_hotels]
    }

@router.get("/transfers", response_model=TransferQueryResponse, summary="Query standardized transfers by location/route")
async def get_transfers_for_location(
    user: OptionalUser,
    location: str = Query(..., description="Route or location name e.g. Guwahati - Shillong"),
    vehicle_type: Optional[str] = Query(None, description="Vehicle category e.g. SUV, Sedan"),
):
    """
    Deterministic query: transfers WHERE location=location AND vehicle_type=vehicle_type.
    """
    matched_transfers = query_transfers(
        location=location,
        vehicle_type=vehicle_type
    )
    return {
        "status": "success",
        "location": location,
        "count": len(matched_transfers),
        "transfers": [t.model_dump() for t in matched_transfers]
    }
