"""
test_proposal_schema_and_orchestration.py — Unit Tests for Proposal Schema & AI Orchestration
"""

import pytest
from src.models.proposal_schema import (
    ProposalHotel,
    ProposalActivity,
    ProposalTransfer,
    ProposalMeal,
    ProposalDay,
    ProposalExtraSections,
    FinalProposalSchema
)


def test_final_proposal_schema_validation():
    """Verify strict Pydantic model serialization and alias resolution."""
    hotel = ProposalHotel(
        name="Lalit Grand Palace Srinagar",
        category="5 Star",
        price_per_night=32000.0,
        location="Srinagar",
        meal_plan="MAP",
        inclusions=["Breakfast", "Dinner"]
    )
    assert hotel.name == "Lalit Grand Palace Srinagar"

    transfer = ProposalTransfer(
        type="Airport Pickup",
        vehicle="Innova Crysta",
        from_location="Srinagar Airport",
        to="Lalit Grand Palace",
        timing="02:00 PM",
        price=2500.0
    )
    # Check alias dump works
    dumped_transfer = transfer.model_dump(by_alias=True)
    assert dumped_transfer["type"] == "Airport Pickup"
    assert dumped_transfer["from"] == "Srinagar Airport"

    day = ProposalDay(
        day_number=1,
        title="Arrival in Srinagar & Shikara Ride",
        description="Check in at the heritage palace and enjoy a relaxing Shikara ride on Dal Lake.",
        sub_destination="Srinagar",
        hotels=[hotel],
        transfers=[transfer]
    )

    extra = ProposalExtraSections(
        what_to_pack="Warm jackets, thermal wear, sturdy boots.",
        cancellation_policy="Full refund up to 30 days prior."
    )

    proposal = FinalProposalSchema(
        destination="Kashmir",
        sub_destinations=["Srinagar", "Gulmarg", "Pahalgam"],
        overview="Experience the Paradise on Earth with luxury stays.",
        duration_days=6,
        currency="INR",
        total_price=185000.0,
        price_per_person=92500.0,
        days=[day],
        inclusions=["All accommodation", "Private transport", "Shikara ride"],
        exclusions=["Flights", "Personal expenses"],
        extra_sections=extra
    )

    dumped = proposal.model_dump(by_alias=True)
    assert dumped["destination"] == "Kashmir"
    assert dumped["days"][0]["hotels"][0]["name"] == "Lalit Grand Palace Srinagar"
    assert dumped["extra_sections"]["what_to_pack"] == "Warm jackets, thermal wear, sturdy boots."
