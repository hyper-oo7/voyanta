"""
test_validation_service.py — Unit tests for the proposal itinerary validation checks.
"""
import pytest
from unittest.mock import MagicMock, patch
from src.services.validation_service import (
    check_repetition,
    check_budget,
    check_logistics,
    check_pacing,
    validate_proposal_itinerary,
)

def test_check_repetition():
    # 1. Trigger case: same activity category (adventure) on 3 consecutive days
    items_trigger = [
        {"id": "it-1", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 1}},
        {"id": "it-2", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 2}},
        {"id": "it-3", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 3}}
    ]
    resolved_objs = {
        "obj-1": {"id": "obj-1", "object_type": "adventure"}
    }
    warnings = check_repetition(items_trigger, resolved_objs)
    assert len(warnings) == 1
    assert warnings[0]["rule"] == "repetition"
    assert "adventure" in warnings[0]["message"]
    assert set(warnings[0]["affected_item_ids"]) == {"it-1", "it-2", "it-3"}

    # 2. Non-trigger case: same category but non-consecutive days (Days 1, 2, 4)
    items_non_consec = [
        {"id": "it-1", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 1}},
        {"id": "it-2", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 2}},
        {"id": "it-3", "kind": "activity", "ref_id": "obj-1", "meta": {"day": 4}}
    ]
    warnings = check_repetition(items_non_consec, resolved_objs)
    assert len(warnings) == 0

    # 3. Non-trigger case: naturally consecutive category 'hotel'
    items_hotel = [
        {"id": "it-1", "kind": "hotel", "ref_id": "obj-2", "meta": {"day": 1}},
        {"id": "it-2", "kind": "hotel", "ref_id": "obj-2", "meta": {"day": 2}},
        {"id": "it-3", "kind": "hotel", "ref_id": "obj-2", "meta": {"day": 3}}
    ]
    resolved_objs_hotel = {
        "obj-2": {"id": "obj-2", "object_type": "hotel"}
    }
    warnings = check_repetition(items_hotel, resolved_objs_hotel)
    assert len(warnings) == 0


def test_check_budget():
    # 1. Trigger case: cost exceeds budget by > 10% (cost 1200, budget 1000, limit 1100)
    items = [
        {"id": "it-1", "unit_price": 400.0, "qty": 2.0},  # 800
        {"id": "it-2", "unit_price": 400.0, "qty": 1.0}   # 400 => total 1200
    ]
    brief = {"budget": 1000.0}
    warnings = check_budget(items, brief)
    assert len(warnings) == 1
    assert warnings[0]["rule"] == "budget"
    assert "exceeds" in warnings[0]["message"]
    assert "20.0%" in warnings[0]["message"]

    # 2. Non-trigger case: cost exceeds budget by <= 10% (cost 1050, budget 1000)
    items_under = [
        {"id": "it-1", "unit_price": 1050.0, "qty": 1.0}
    ]
    warnings = check_budget(items_under, brief)
    assert len(warnings) == 0


def test_check_logistics():
    resolved_objs = {
        "h-1": {"id": "h-1", "destination": "Dubai", "area": "Marina"},
        "a-1": {"id": "a-1", "destination": "Dubai", "area": "Downtown"}
    }

    # 1. Trigger case: Marina hotel and Downtown activity on Day 1, with no transfer items
    items_trigger = [
        {"id": "it-1", "kind": "hotel", "ref_id": "h-1", "meta": {"day": 1}},
        {"id": "it-2", "kind": "activity", "ref_id": "a-1", "meta": {"day": 1}}
    ]
    warnings = check_logistics(items_trigger, resolved_objs)
    assert len(warnings) == 1
    assert warnings[0]["rule"] == "logistics"
    assert "mismatch" in warnings[0]["message"]
    assert "Marina" in warnings[0]["message"] and "Downtown" in warnings[0]["message"]

    # 2. Non-trigger case: Marina hotel and Downtown activity on Day 1, WITH transfer item on Day 1
    items_with_transfer = [
        {"id": "it-1", "kind": "hotel", "ref_id": "h-1", "meta": {"day": 1}},
        {"id": "it-2", "kind": "activity", "ref_id": "a-1", "meta": {"day": 1}},
        {"id": "it-3", "kind": "transfer", "meta": {"day": 1}}
    ]
    warnings = check_logistics(items_with_transfer, resolved_objs)
    assert len(warnings) == 0


def test_check_pacing():
    # 1. Trigger case: 5 activity items on Day 1
    items_trigger = [
        {"id": f"it-{i}", "kind": "activity", "meta": {"day": 1}} for i in range(5)
    ]
    warnings = check_pacing(items_trigger)
    assert len(warnings) == 1
    assert warnings[0]["rule"] == "pacing"
    assert "Day 1 has 5 activities" in warnings[0]["message"]

    # 2. Non-trigger case: 4 activity items on Day 1
    items_ok = [
        {"id": f"it-{i}", "kind": "activity", "meta": {"day": 1}} for i in range(4)
    ]
    warnings = check_pacing(items_ok)
    assert len(warnings) == 0


@pytest.mark.anyio
async def test_validate_proposal_itinerary_db():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.in_.return_value = mock_table

    # Mock proposals query returning a brief with budget 1000
    mock_proposal = [{"id": "prop-123", "brief": {"budget": 1000.0}}]
    # Mock items query returning 5 activities on Day 1 (pacing alert) and total costing 1200 (budget alert)
    mock_items = [
        {"id": f"it-{i}", "kind": "activity", "ref_id": None, "unit_price": 240.0, "qty": 1.0, "meta": {"day": 1}}
        for i in range(5)
    ]

    mock_prop_res = MagicMock()
    mock_prop_res.data = mock_proposal
    
    mock_items_res = MagicMock()
    mock_items_res.data = mock_items

    def execute_side_effect():
        called_table = mock_sb.table.call_args[0][0]
        if called_table == "proposals":
            return mock_prop_res
        elif called_table == "proposal_items":
            return mock_items_res
        return MagicMock(data=[])

    mock_table.execute.side_effect = execute_side_effect

    with patch("src.services.validation_service.get_supabase_client", return_value=mock_sb):
        warnings = validate_proposal_itinerary("prop-123")
        assert len(warnings) == 2  # Pacing warning + Budget warning
        
        rules = [w["rule"] for w in warnings]
        assert "pacing" in rules
        assert "budget" in rules
