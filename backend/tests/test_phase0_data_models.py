"""
test_phase0_data_models.py — Unit tests for Phase 0 Data Models
================================================================
Verifies schema validation, JSON serialization/deserialization, slot map integrity,
and filtering keys for Itinerary Blocks, Attraction Master Records, Standardized Hotels, and Transfers.
"""

import pytest
from pydantic import ValidationError

from src.models.itinerary_block import (
    ItineraryBlock,
    AttractionMasterRecord,
    StandardizedHotel,
    StandardizedTransfer,
)


def test_itinerary_block_valid_instantiation():
    """Verify ItineraryBlock matches Phase 0 prompt JSON sample."""
    sample = {
        "block_id": "shillong_family_1day_003",
        "destination": "Shillong",
        "region": "Meghalaya",
        "duration_type": "1_day",
        "theme_tags": ["family", "budget"],
        "source_pdf": "agency_pdf_2023_014.pdf",
        "attractions_sequence": ["ward_lake", "police_bazaar", "elephant_falls"],
        "slot_map": {
            "morning": ["ward_lake"],
            "afternoon": ["police_bazaar"],
            "evening": ["elephant_falls"]
        },
        "hotel_used_in_source": "Hotel Pine Hill",
        "confidence": 0.87
    }

    block = ItineraryBlock(**sample)
    assert block.block_id == "shillong_family_1day_003"
    assert block.destination == "Shillong"
    assert block.confidence == 0.87
    assert block.slot_map["morning"] == ["ward_lake"]
    assert "family" in block.theme_tags


def test_itinerary_block_confidence_validation():
    """Ensure confidence score outside [0, 1] raises a ValidationError."""
    with pytest.raises(ValidationError):
        ItineraryBlock(
            block_id="invalid_1",
            destination="Test",
            region="TestRegion",
            confidence=1.5
        )


def test_attraction_master_record():
    """Verify AttractionMasterRecord matches Phase 0 prompt JSON sample."""
    sample = {
        "attraction_id": "ward_lake",
        "name": "Ward's Lake",
        "city": "Shillong",
        "duration_minutes": 60,
        "open_time": "08:00",
        "close_time": "17:00",
        "best_slot": ["morning"],
        "entry_fee": 20,
        "lat": 25.5744,
        "lng": 91.8825,
        "tags": ["nature", "family", "budget"]
    }

    attraction = AttractionMasterRecord(**sample)
    assert attraction.attraction_id == "ward_lake"
    assert attraction.entry_fee == 20.0
    assert attraction.lat == 25.5744
    assert attraction.best_slot == ["morning"]


def test_attraction_coordinate_validation():
    """Verify invalid lat/lng values raise ValidationError."""
    with pytest.raises(ValidationError):
        AttractionMasterRecord(
            attraction_id="bad_coords",
            name="Bad Coords Spot",
            city="TestCity",
            lat=95.0  # Invalid latitude > 90
        )


def test_standardized_hotel():
    """Verify StandardizedHotel auto-corrects price_max if less than price_min."""
    hotel = StandardizedHotel(
        name="Hotel Pine Hill",
        location="Shillong",
        price_min=3500.0,
        price_max=3000.0,  # lower than min
        meal_plan="CP",
        star="3_star",
        amenities=["wifi", "parking", "pure_veg"]
    )

    assert hotel.price_min == 3500.0
    assert hotel.price_max == 3500.0  # Auto-corrected to price_min
    assert "pure_veg" in hotel.amenities


def test_standardized_transfer():
    """Verify StandardizedTransfer default inclusions and capacity check."""
    transfer = StandardizedTransfer(
        location="Guwahati to Shillong",
        vehicle_type="SUV",
        capacity=6,
        price_min=4500.0,
        price_max=5500.0
    )

    assert transfer.capacity == 6
    assert transfer.price_min == 4500.0
    assert transfer.price_max == 5500.0
    assert "fuel" in transfer.inclusions
