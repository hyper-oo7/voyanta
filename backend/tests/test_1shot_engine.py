"""
test_1shot_engine.py — Automated Tests for Phase 1 Engine
========================================================
Verifies Day Module caching, Hotel Rate parsing, Full-Budget Margin calculation,
and 1-Shot proposal assembly.
"""

import pytest
from src.models.day_module_schema import MarginConfig
from src.services.margin_service import calculate_full_budget_costing
from src.services.hotel_rate_parser import parse_hotel_rates_csv, parse_hotel_rates_text
from src.services.day_module_cache_service import get_cached_distance, store_cached_distance
from src.services.assembly_engine import assemble_1shot_proposal


def test_full_budget_margin_percentage():
    """Verify percentage margin calculation on subtotal."""
    cfg = MarginConfig(margin_type="percentage", margin_value=15.0, tax_rate_percent=5.0, discount_amount=0.0)
    result = calculate_full_budget_costing(10000.0, cfg, num_travelers=2)

    assert result.net_subtotal == 10000.0
    assert result.margin_amount == 1500.0  # 15% of 10000
    assert result.gross_amount == 11500.0  # 10000 + 1500
    assert result.tax_amount == 575.0     # 5% of 11500
    assert result.final_package_total == 12075.0
    assert result.price_per_person == 6037.5  # 12075 / 2


def test_full_budget_margin_flat():
    """Verify flat amount margin calculation on subtotal."""
    cfg = MarginConfig(margin_type="flat", margin_value=2500.0, tax_rate_percent=5.0, discount_amount=500.0)
    result = calculate_full_budget_costing(10000.0, cfg, num_travelers=1)

    assert result.net_subtotal == 10000.0
    assert result.margin_amount == 2500.0
    assert result.gross_amount == 12500.0
    assert result.tax_amount == 625.0
    assert result.discount_amount == 500.0
    assert result.final_package_total == 12625.0


def test_hotel_rate_csv_parser():
    """Verify CSV rate sheet parsing."""
    csv_data = """Hotel Name, Location, Category, Room Type, Meal Plan, Net Rate
La Castle Residency, Shillong, Deluxe, Superior, MAP, 4500
Ri Kynjai Resort, Umiam, Luxury, Lake View Suite, CP, 8500"""

    rates = parse_hotel_rates_csv(csv_data, agency_id="agency_test")
    assert len(rates) == 2
    assert rates[0].hotel_name == "La Castle Residency"
    assert rates[0].meal_plan == "MAP"
    assert rates[0].net_rate == 4500.0
    assert rates[1].hotel_name == "Ri Kynjai Resort"
    assert rates[1].meal_plan == "CP"
    assert rates[1].net_rate == 8500.0


def test_distance_cache_lookup():
    """Verify 0ms distance matrix caching."""
    store_cached_distance("Manali", "Solang Valley", 14.0, 0.5, True)
    entry = get_cached_distance("Manali", "Solang Valley")
    assert entry is not None
    assert entry["distance_km"] == 14.0
    assert entry["travel_time_hours"] == 0.5

    # Reverse lookup check
    entry_rev = get_cached_distance("Solang Valley", "Manali")
    assert entry_rev is not None
    assert entry_rev["distance_km"] == 14.0


def test_assemble_1shot_proposal():
    """Verify 1-shot proposal assembly execution."""
    cfg = MarginConfig(margin_type="percentage", margin_value=10.0, tax_rate_percent=5.0)
    proposal = assemble_1shot_proposal(
        destination="Himachal",
        duration_days=3,
        client_name="Raman test",
        group_type="friends",
        pace="fast",
        budget_per_head=20000.0,
        num_travelers=2,
        margin_config=cfg
    )

    assert proposal.destination == "Himachal"
    assert proposal.duration_days == 3
    assert len(proposal.days) == 3
    assert proposal.total_price > 0
    assert proposal.price_per_person > 0
    assert len(proposal.inclusions) > 0
    assert proposal.extra_sections.what_to_pack is not None
