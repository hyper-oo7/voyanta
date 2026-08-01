"""
inventory_selection_router.py — Phase 6 Inventory Query Router
================================================================
Exposes deterministic REST endpoints for querying standardized hotels & transfers by
city location and budget band for instant agent 1-click selection.
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Query, Depends
from fastapi.responses import JSONResponse

from src.core.security import verify_token_optional
from src.services.hotel_transfer_selection_service import query_hotels, query_transfers

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inventory", tags=["Inventory Selection V2"])


@router.get("/hotels")
async def get_hotels_for_city(
    city: str = Query(..., description="City or location name e.g. Shillong"),
    budget_band: Optional[str] = Query(None, description="Budget band: low, mid, high"),
    min_price: Optional[float] = Query(None, description="Minimum price bound"),
    max_price: Optional[float] = Query(None, description="Maximum price bound"),
    star_rating: Optional[str] = Query(None, description="Star rating filter e.g. 4_star"),
    user: Any = Depends(verify_token_optional)
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
    return JSONResponse(content={
        "status": "success",
        "city": city,
        "count": len(matched_hotels),
        "hotels": [h.model_dump() for h in matched_hotels]
    })


@router.get("/transfers")
async def get_transfers_for_location(
    location: str = Query(..., description="Route or location name e.g. Guwahati - Shillong"),
    vehicle_type: Optional[str] = Query(None, description="Vehicle category e.g. SUV, Sedan"),
    user: Any = Depends(verify_token_optional)
):
    """
    Deterministic query: transfers WHERE location=location AND vehicle_type=vehicle_type.
    """
    matched_transfers = query_transfers(
        location=location,
        vehicle_type=vehicle_type
    )
    return JSONResponse(content={
        "status": "success",
        "location": location,
        "count": len(matched_transfers),
        "transfers": [t.model_dump() for t in matched_transfers]
    })
