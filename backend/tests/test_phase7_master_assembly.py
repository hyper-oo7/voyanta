"""
test_phase7_master_assembly.py — Unit tests for Phase 7 Master Assembly & Pure Arithmetic Costing
====================================================================================================
Verifies pure arithmetic auto-sum costing, trip JSON merging across phases, and WhatsApp-ready
summary text generation.
"""

import pytest

from src.models.day_module_schema import MarginConfig
from src.models.proposal_schema import FinalProposalSchema
from src.services.master_assembly_service import (
    calculate_exact_trip_arithmetic,
    generate_whatsapp_proposal_summary,
    assemble_master_trip_proposal,
)


def test_pure_arithmetic_costing():
    """Verify pure arithmetic auto-sum costing (Attractions + Hotels + Transfers)."""
    days_data = [
        {
            "timed_schedule": [
                {"type": "activity", "entry_fee": 20.0},
                {"type": "activity", "entry_fee": 50.0}
            ]
        }
    ]
    hotels_data = [{"price_min": 4000.0, "nights": 2}]
    transfers_data = [{"price_min": 5000.0}]

    margin_cfg = MarginConfig(margin_type="percentage", margin_value=10.0, tax_rate_percent=5.0)

    # 2 Travelers -> 1 room needed
    # Entry fees = (20 + 50) * 2 = 140
    # Hotels = 4000 * 2 nights * 1 room = 8000
    # Transfers = 5000
    # Net Subtotal = 140 + 8000 + 5000 = 13140
    result = calculate_exact_trip_arithmetic(
        days=days_data,
        hotels=hotels_data,
        transfers=transfers_data,
        num_travelers=2,
        margin_config=margin_cfg
    )

    assert result["attractions_fee_total"] == 140.0
    assert result["hotels_fee_total"] == 8000.0
    assert result["transfers_fee_total"] == 5000.0
    assert result["raw_net_subtotal"] == 13140.0


def test_whatsapp_proposal_summary_generation():
    """Verify WhatsApp text summary formatting."""
    summary = generate_whatsapp_proposal_summary(
        client_name="Raman Kumar Jha",
        destination="Shillong & Cherrapunji",
        duration_days=3,
        num_travelers=2,
        days=[],
        price_per_person=24500.0,
        proposal_id="prop_test_001"
    )

    assert "Raman Kumar Jha" in summary
    assert "Shillong & Cherrapunji" in summary
    assert "₹24,500" in summary
    assert "https://voyanta.app/p/prop_test_001" in summary


def test_assemble_master_trip_proposal():
    """Verify full trip assembly merging Phase 4 blocks + Phase 5 schedules + Phase 6 hotels."""
    days_per_dest = {"Shillong": 1, "Cherrapunji": 1}
    retrieved_blocks = [
        {
            "destination": "Shillong",
            "attractions_sequence": ["ward_lake", "police_bazaar"]
        },
        {
            "destination": "Cherrapunji",
            "attractions_sequence": ["nohkalikai_falls", "mawsmai_caves"]
        }
    ]

    master = assemble_master_trip_proposal(
        client_name="Test Traveler",
        days_per_destination=days_per_dest,
        retrieved_day_blocks=retrieved_blocks,
        theme_tags=["family", "nature"],
        num_travelers=2
    )

    assert "proposal" in master
    assert "whatsapp_summary" in master
    assert "costing_breakdown" in master

    prop = master["proposal"]
    assert prop["duration_days"] == 2
    assert len(prop["days"]) == 2
    assert prop["days"][0]["sub_destination"] == "Shillong"
    assert prop["days"][1]["sub_destination"] == "Cherrapunji"
