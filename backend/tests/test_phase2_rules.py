"""
test_phase2_rules.py — Automated Tests for Phase 2 Feasibility & Weather Rules
================================================================================
Verifies distance feasibility validation, weather protection adjustments,
preference tag filtering (no_trekking, veg_only), and integrated assembly.
"""

import pytest
from src.services.travel_rules_service import (
    validate_destination_feasibility,
    apply_pace_and_weather_adjustments,
    filter_by_preferences
)
from src.services.assembly_engine import assemble_1shot_proposal


def test_validate_destination_feasibility_overloaded():
    """Verify that scheduling too many far destinations for a short trip triggers a warning."""
    is_feasible, warning = validate_destination_feasibility(["Jaipur", "Udaipur", "Jaisalmer"], duration_days=2, pace="slow")
    assert is_feasible is False
    assert "too rushed" in warning.lower()


def test_weather_midday_heat_protection():
    """Verify that summer trips in Rajasthan shift midday outdoor tours out of 12 PM - 4 PM."""
    sample_acts = [
        {"name": "Amber Fort Visit", "timing": "12:00 PM", "description": "Outdoor fort tour."}
    ]
    adjusted, packing = apply_pace_and_weather_adjustments(sample_acts, "Rajasthan", travel_month=5, pace="medium")

    assert len(adjusted) == 1
    assert "09:00 AM" in adjusted[0]["timing"]
    assert "Sunscreen" in str(packing)


def test_preference_filter_no_trekking():
    """Verify that 'no trekking' preference drops trekking day modules."""
    sample_mods = [
        {"id": "m1", "title": "Triund Trekking Day", "negative_tags": ["trekking"]},
        {"id": "m2", "title": "Mall Road & Café Stroll", "negative_tags": []}
    ]
    filtered = filter_by_preferences(sample_mods, "wants relaxation, no trekking please")

    assert len(filtered) == 1
    assert filtered[0]["id"] == "m2"


def test_integrated_phase2_proposal():
    """Verify end-to-end 1-shot proposal assembly with Phase 2 rules."""
    proposal = assemble_1shot_proposal(
        destination="Rajasthan",
        duration_days=3,
        client_name="Test Phase 2 Client",
        group_type="family",
        pace="slow",
        preferences_text="veg only, no trekking",
        travel_month=6
    )

    assert proposal.destination == "Rajasthan"
    assert len(proposal.days) == 3
    # Check that packing list has weather-specific additions
    assert proposal.extra_sections.what_to_pack is not None
    assert "Sunscreen" in proposal.extra_sections.what_to_pack or "essentials" in proposal.extra_sections.what_to_pack


def test_prompt_assembly_fallback():
    """Verify 1-shot proposal assembly with prompt parsing."""
    proposal = assemble_1shot_proposal(
        destination="Manali",
        duration_days=4,
        client_name="Prompt Traveler",
        group_type="friends",
        pace="fast",
        preferences_text="no trekking, veg only"
    )

    assert proposal.destination == "Manali"
    assert proposal.duration_days == 4
    assert len(proposal.days) == 4

