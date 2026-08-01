"""
test_phase5_auto_scheduler.py — Unit tests for Phase 5 Auto-Scheduling Engine
==============================================================================
Verifies time parsing, Haversine spatial geodesic distance estimation, slot priority sorting,
greedy nearest-neighbor routing, operating window compliance, and timed schedule generation.
"""

import pytest

from src.services.auto_scheduler_service import (
    calculate_haversine_distance_km,
    parse_time_to_minutes,
    format_minutes_to_time,
    generate_timed_day_schedule,
    SEED_ATTRACTIONS_REGISTRY,
)


def test_time_parsing_and_formatting():
    """Verify time conversion between string formats and minutes from midnight."""
    assert parse_time_to_minutes("09:00 AM") == 540
    assert parse_time_to_minutes("02:30 PM") == 870
    assert parse_time_to_minutes("12:00 PM") == 720
    assert parse_time_to_minutes("12:00 AM") == 0

    assert format_minutes_to_time(540) == "09:00 AM"
    assert format_minutes_to_time(870) == "02:30 PM"
    assert format_minutes_to_time(720) == "12:00 PM"


def test_haversine_distance_calculation():
    """Verify spatial geodesic distance between Ward's Lake and Elephant Falls."""
    # Ward's Lake (25.5744, 91.8825) to Elephant Falls (25.5356, 91.8227) ~ 7.5 km
    dist = calculate_haversine_distance_km(25.5744, 91.8825, 25.5356, 91.8227)
    assert 6.0 <= dist <= 9.0


def test_generate_timed_day_schedule_shillong():
    """Verify greedy timed schedule generation for Shillong attractions."""
    attraction_ids = ["ward_lake", "police_bazaar", "elephant_falls"]
    result = generate_timed_day_schedule(
        attraction_ids=attraction_ids,
        city="Shillong",
        start_time_str="09:00 AM"
    )

    assert result["city"] == "Shillong"
    assert result["start_time"] == "09:00 AM"

    schedule = result["timed_schedule"]
    assert len(schedule) >= 3

    # Check activity & transit items sequence
    activities = [item for item in schedule if item["type"] == "activity"]
    transits = [item for item in schedule if item["type"] == "transit"]

    assert len(activities) == 3
    assert len(transits) == 2  # 2 transits for 3 attractions

    # Verify morning slot attraction (ward_lake) comes before evening (police_bazaar)
    act_ids = [a["attraction_id"] for a in activities]
    assert act_ids[0] == "ward_lake"  # morning slot priority

    # Verify total entry fee calculation (20 + 0 + 50 = 70)
    assert result["summary"]["total_entry_fee"] == 70.0
    assert result["summary"]["attractions_count"] == 3


def test_generate_timed_day_schedule_operating_hours_wait():
    """Verify waiting behavior if arrival is before opening time."""
    attraction_ids = ["police_bazaar"]  # Opens at 10:00 AM
    result = generate_timed_day_schedule(
        attraction_ids=attraction_ids,
        city="Shillong",
        start_time_str="08:00 AM"
    )

    activities = [item for item in result["timed_schedule"] if item["type"] == "activity"]
    assert len(activities) == 1
    # Should start at or after 10:00 AM opening time
    assert parse_time_to_minutes(activities[0]["start_time"]) >= 600  # 10:00 AM = 600 mins
