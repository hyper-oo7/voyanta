"""
master_assembly_service.py — Phase 7 Master Assembly, Pure Arithmetic Costing & Dual-Format Output
====================================================================================================
Merges per-day JSON objects (Phase 4 blocks + Phase 5 timed schedule + Phase 6 hotels & transfers)
into one complete trip JSON, executes pure arithmetic auto-sum costing, and generates WhatsApp-ready
summaries & PDF render payloads.
"""

import math
import logging
from typing import List, Dict, Any, Optional

from src.models.proposal_schema import (
    FinalProposalSchema, ProposalDay, ProposalHotel,
    ProposalActivity, ProposalExtraSections
)
from src.models.day_module_schema import MarginConfig
from src.services.margin_service import calculate_full_budget_costing
from src.services.auto_scheduler_service import generate_timed_day_schedule, SEED_ATTRACTIONS_REGISTRY
from src.services.hotel_transfer_selection_service import query_hotels, query_transfers

logger = logging.getLogger(__name__)


def calculate_exact_trip_arithmetic(
    days: List[Dict[str, Any]],
    hotels: List[Dict[str, Any]],
    transfers: List[Dict[str, Any]],
    num_travelers: int,
    margin_config: MarginConfig
) -> Dict[str, Any]:
    """
    Pure Arithmetic Auto-Sum Costing:
    - Σ(attraction entry fees × num_travelers)
    - Σ(hotel room night price × nights × room_count)
    - Σ(transfer charges)
    Pure arithmetic, $0 AI LLM cost.
    """
    num_travelers = max(1, num_travelers)
    room_count = math.ceil(num_travelers / 2.0)

    # 1. Sum attraction entry fees
    attractions_fee_total = 0.0
    for day in days:
        schedule = day.get("timed_schedule", [])
        for item in schedule:
            if item.get("type") == "activity":
                fee = float(item.get("entry_fee", 0.0))
                attractions_fee_total += (fee * num_travelers)

    # 2. Sum hotel room night rates
    hotels_fee_total = 0.0
    for hotel in hotels:
        nightly_rate = float(hotel.get("price_min") or hotel.get("price_per_night") or 3500.0)
        nights = int(hotel.get("nights", 1))
        hotels_fee_total += (nightly_rate * nights * room_count)

    # 3. Sum transfer vehicle charges
    transfers_fee_total = 0.0
    for transfer in transfers:
        t_rate = float(transfer.get("price_min") or transfer.get("rate") or 3000.0)
        transfers_fee_total += t_rate

    raw_subtotal = attractions_fee_total + hotels_fee_total + transfers_fee_total

    # Apply full budget margin service (% or flat + tax)
    costing_breakdown = calculate_full_budget_costing(
        net_subtotal=raw_subtotal,
        margin_config=margin_config,
        num_travelers=num_travelers,
        currency="INR"
    )

    return {
        "attractions_fee_total": round(attractions_fee_total, 2),
        "hotels_fee_total": round(hotels_fee_total, 2),
        "transfers_fee_total": round(transfers_fee_total, 2),
        "raw_net_subtotal": round(raw_subtotal, 2),
        "costing": costing_breakdown
    }


def generate_whatsapp_proposal_summary(
    client_name: str,
    destination: str,
    duration_days: int,
    num_travelers: int,
    days: List[ProposalDay],
    price_per_person: float,
    proposal_id: str = "prop_preview"
) -> str:
    """
    Generates a WhatsApp-optimized clean text summary with emojis, highlights, and link.
    """
    highlights_lines = []
    for day in days[:4]:  # Top 4 days for preview
        act_names = [a.name for a in day.activities[:3]]
        act_str = " → ".join(act_names) if act_names else "Sightseeing & Leisure"
        highlights_lines.append(f"• *Day {day.day_number} ({day.sub_destination})*: {act_str}")

    highlights_block = "\n".join(highlights_lines)

    summary = f"""✈️ *Voyanta Proposal for {client_name}*
📍 *Destination*: {destination} ({duration_days} Days)
👥 *Travelers*: {num_travelers} Persons

🗓️ *Itinerary Highlights*:
{highlights_block}

💰 *Package Total*: ₹{int(price_per_person):,} / person (All-inclusive)
📄 *View Interactive Web Proposal & PDF*:
https://voyanta.app/p/{proposal_id}
"""
    return summary


def assemble_master_trip_proposal(
    client_name: str,
    days_per_destination: Dict[str, int],
    retrieved_day_blocks: List[Dict[str, Any]],
    theme_tags: List[str],
    num_travelers: int = 2,
    margin_config: Optional[MarginConfig] = None,
    selected_hotels: Optional[List[Dict[str, Any]]] = None,
    selected_transfers: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Phase 7 Master Assembly:
    - Merges per-day retrieved blocks + Phase 5 timed schedules + Phase 6 hotels & transfers into one trip JSON.
    - Calculates pure arithmetic costing auto-sum.
    - Produces FinalProposalSchema + WhatsApp summary.
    """
    if margin_config is None:
        margin_config = MarginConfig(margin_type="percentage", margin_value=15.0, tax_rate_percent=5.0)

    destinations_list = list(days_per_destination.keys())
    primary_dest = ", ".join(destinations_list) if destinations_list else "Custom Itinerary"
    total_days = sum(days_per_destination.values())

    proposal_days: List[ProposalDay] = []
    raw_day_schedules: List[Dict[str, Any]] = []

    for idx, day_block in enumerate(retrieved_day_blocks, start=1):
        city = day_block.get("destination", "Sightseeing Spot")
        attractions = day_block.get("attractions_sequence", [])

        # Generate Phase 5 Timed Day Schedule
        schedule_res = generate_timed_day_schedule(
            attraction_ids=attractions,
            city=city,
            start_time_str="09:00 AM"
        )
        raw_day_schedules.append(schedule_res)

        # Convert to ProposalActivity list
        activities = []
        for item in schedule_res.get("timed_schedule", []):
            if item.get("type") == "activity":
                activities.append(
                    ProposalActivity(
                        name=item.get("name", "Sightseeing"),
                        duration=f"{item.get('duration_minutes', 60)} mins",
                        timing=item.get("start_time", "09:00 AM"),
                        location=item.get("city", city),
                        description=item.get("description", "")
                    )
                )

        # Matched Hotel
        city_hotels = query_hotels(city=city)
        selected_hotel_obj = city_hotels[0] if city_hotels else None

        hotels_list = []
        if selected_hotel_obj:
            hotels_list.append(
                ProposalHotel(
                    name=selected_hotel_obj.name,
                    category=selected_hotel_obj.star.replace("_", " ").title(),
                    location=selected_hotel_obj.location,
                    meal_plan=selected_hotel_obj.meal_plan,
                    price_per_night=selected_hotel_obj.price_min
                )
            )

        p_day = ProposalDay(
            day_number=idx,
            title=f"Day {idx}: {city} Sightseeing & Exploration",
            description=f"Curated day in {city} with scheduled visits to top attractions and leisure.",
            sub_destination=city,
            schedule=f"Timed Schedule ({schedule_res['start_time']} – {schedule_res['end_time']})",
            hotels=hotels_list,
            activities=activities
        )
        proposal_days.append(p_day)

    # Hotels & Transfers lists for arithmetic sum
    if selected_hotels is None:
        selected_hotels = [{"price_min": 4000.0, "nights": total_days - 1}]
    if selected_transfers is None:
        selected_transfers = [{"price_min": 4500.0}]

    costing_res = calculate_exact_trip_arithmetic(
        days=raw_day_schedules,
        hotels=selected_hotels,
        transfers=selected_transfers,
        num_travelers=num_travelers,
        margin_config=margin_config
    )

    costing = costing_res["costing"]

    # Extra Sections
    extra_sections = ProposalExtraSections(
        what_to_pack=f"Essentials for {primary_dest}: Comfortable walking shoes, sunscreen SPF 50+, camera, and light jacket.",
        important_notes="Please carry a valid government-issued photo ID. Standard check-in is 12:00 PM.",
        cancellation_policy="Full refund 15 days prior to arrival date. 50% refund 7-14 days prior.",
        terms_of_payment="50% deposit to confirm reservation. Remaining balance due 7 days prior to arrival.",
        dos_and_donts="Do respect local culture and environment. Don't carry single-use plastic."
    )

    proposal = FinalProposalSchema(
        destination=primary_dest,
        sub_destinations=destinations_list,
        overview=f"Exclusive {total_days}-Day curated trip to {primary_dest} customized for {client_name}.",
        duration_days=total_days,
        currency="INR",
        total_price=costing.final_package_total,
        price_per_person=costing.price_per_person,
        days=proposal_days,
        inclusions=["Private AC Vehicle for all transfers & sightseeing", "Hotel Accommodation with breakfast & dinner", "All toll, parking, driver allowances & taxes"],
        exclusions=["Airfare / Train tickets", "Personal expenses & tips", "Monument entry fees & adventure charges"],
        extra_sections=extra_sections,
        model_used="Voyanta 1-Shot Sub-Minute Engine v3.0 (Zero-Hallucination Pipeline)"
    )

    whatsapp_summary = generate_whatsapp_proposal_summary(
        client_name=client_name,
        destination=primary_dest,
        duration_days=total_days,
        num_travelers=num_travelers,
        days=proposal_days,
        price_per_person=costing.price_per_person
    )

    return {
        "proposal": proposal.model_dump(by_alias=True),
        "whatsapp_summary": whatsapp_summary,
        "costing_breakdown": costing_res
    }
