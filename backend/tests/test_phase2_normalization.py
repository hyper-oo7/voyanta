"""
test_phase2_normalization.py — Unit tests for Phase 2 Hotel & Transfer Normalization
=====================================================================================
Verifies city/route location standardization, state suffix trimming, airport alias resolution,
and CSV rate sheet normalization to ensure Phase 6 exact-match joins work deterministically.
"""

import pytest

from src.models.itinerary_block import StandardizedHotel, StandardizedTransfer
from src.services.hotel_transfer_normalization_service import (
    normalize_city_name,
    normalize_hotel_entry,
    normalize_transfer_entry,
    parse_and_normalize_hotels_csv,
    parse_and_normalize_transfers_csv,
)


def test_normalize_city_name_casing_and_suffixes():
    """Verify city name normalization cleans casing, state suffixes, and parentheticals."""
    assert normalize_city_name("shillong") == "Shillong"
    assert normalize_city_name("Shillong, Meghalaya") == "Shillong"
    assert normalize_city_name("Shillong, Meghalaya, India") == "Shillong"
    assert normalize_city_name("Manali (Himachal Pradesh)") == "Manali"
    assert normalize_city_name("Jaipur - Rajasthan") == "Jaipur"


def test_normalize_city_name_airport_aliases():
    """Verify airport code and city alias resolution."""
    assert normalize_city_name("GHY") == "Guwahati"
    assert normalize_city_name("Guwahati Airport") == "Guwahati"
    assert normalize_city_name("IXB") == "Bagdogra"
    assert normalize_city_name("COK") == "Kochi"
    assert normalize_city_name("SXR") == "Srinagar"
    assert normalize_city_name("BOM") == "Mumbai"
    assert normalize_city_name("DEL") == "Delhi"


def test_normalize_city_name_routes():
    """Verify transfer route string normalization."""
    assert normalize_city_name("Guwahati to Shillong") == "Guwahati - Shillong"
    assert normalize_city_name("ghy -> shillong, meghalaya") == "Guwahati - Shillong"


def test_normalize_hotel_entry():
    """Verify raw hotel row normalization into StandardizedHotel."""
    raw_row = {
        "Hotel Name": "Hotel Pine Hill",
        "Location": "shillong, meghalaya",
        "Category": "4 Star Deluxe",
        "Meal Plan": "MAP",
        "Net Rate": "₹4,500"
    }

    hotel = normalize_hotel_entry(raw_row)
    assert isinstance(hotel, StandardizedHotel)
    assert hotel.name == "Hotel Pine Hill"
    assert hotel.location == "Shillong"  # Exact match for attraction city "Shillong"
    assert hotel.star == "4_star"
    assert hotel.meal_plan == "MAP"
    assert hotel.price_min == 4500.0


def test_normalize_transfer_entry():
    """Verify raw transfer row normalization into StandardizedTransfer."""
    raw_row = {
        "Route": "guwahati to shillong",
        "Vehicle": "Innova SUV",
        "Price": "5500",
        "Inclusions": "toll_tax, parking, fuel"
    }

    transfer = normalize_transfer_entry(raw_row)
    assert isinstance(transfer, StandardizedTransfer)
    assert transfer.location == "Guwahati - Shillong"
    assert transfer.vehicle_type == "SUV"
    assert transfer.capacity == 6
    assert transfer.price_min == 5500.0


def test_parse_and_normalize_hotels_csv():
    """Verify CSV string parsing with full location standardization."""
    csv_data = """Hotel Name,City,Star,Meal Plan,Price Min,Price Max
Hotel Pine Hill,shillong,3 Star,CP,3500,4000
Cherra Resort,cherrapunji (meghalaya),4 Star,MAP,5000,5500
    """

    hotels = parse_and_normalize_hotels_csv(csv_data)
    assert len(hotels) == 2
    assert hotels[0].location == "Shillong"
    assert hotels[1].location == "Cherrapunji"
