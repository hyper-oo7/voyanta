"""
test_phase6_selection_service.py — Unit tests for Phase 6 Hotel & Transfer Selection Engine
==============================================================================================
Verifies $0 AI cost deterministic querying of standardized hotels and transfers by
city location, budget band, and vehicle type.
"""

import pytest

from src.models.itinerary_block import StandardizedHotel, StandardizedTransfer
from src.services.hotel_transfer_selection_service import (
    query_hotels,
    query_transfers,
    SEED_HOTELS_INVENTORY,
    SEED_TRANSFERS_INVENTORY,
)


def test_query_hotels_by_city_and_budget_band():
    """Verify hotel querying by city and budget band."""
    # Query Shillong hotels for mid budget band (15k - 35k)
    mid_hotels = query_hotels(city="Shillong", budget_band="mid")
    assert len(mid_hotels) >= 1
    assert any(h.hotel_id == "hotel_shillong_ri_kynjai" for h in mid_hotels)
    assert all(h.location == "Shillong" for h in mid_hotels)


def test_query_hotels_by_star_rating():
    """Verify star rating filter matching."""
    four_star = query_hotels(city="Shillong", star_rating="4_star")
    assert len(four_star) >= 1
    assert four_star[0].star == "4_star"


def test_query_transfers_by_location_and_vehicle():
    """Verify transfer querying by route location and vehicle type."""
    suv_transfers = query_transfers(location="Guwahati - Shillong", vehicle_type="SUV")
    assert len(suv_transfers) >= 1
    top_transfer = suv_transfers[0]
    assert top_transfer.location == "Guwahati - Shillong"
    assert top_transfer.vehicle_type == "SUV"
    assert top_transfer.capacity == 6
    assert "fuel" in top_transfer.inclusions
