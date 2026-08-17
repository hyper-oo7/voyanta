"""
master_assembly_service.py — Phase 7 Master Trip Assembly & Arithmetic Costing
================================================================================
Implements exact arithmetic trip costing, WhatsApp summary formatting, and full
trip JSON synthesis from retrieved blocks, auto-schedules, and hotels.
"""

import math
import logging
from typing import List, Dict, Any, Optional

from src.models.day_module_schema import MarginConfig

logger = logging.getLogger(__name__)


def calculate_exact_trip_arithmetic(
    days: List[Dict[str, Any]],
    hotels: List[Dict[str, Any]],
    transfers: List[Dict[str, Any]],
    num_travelers: int = 2,
    margin_config: Optional[MarginConfig] = None
) -> Dict[str, Any]:
    """
    Pure arithmetic auto-sum costing without LLM hallucination.
    Sums attraction entry fees, hotel stay rates, and transfer costs.
    """
    travelers = max(1, num_travelers)
    rooms_needed = math.ceil(travelers / 2)

    # 1. Attractions / Activities fee total
    attractions_fee_total = 0.0
    for d in days:
        for item in d.get("timed_schedule", []):
            fee = float(item.get("entry_fee") or item.get("price") or 0.0)
            attractions_fee_total += fee * travelers

    # 2. Hotels total
    hotels_fee_total = 0.0
    for h in hotels:
        price = float(h.get("price_min") or h.get("price_per_night") or 0.0)
        nights = int(h.get("nights") or 1)
        hotels_fee_total += price * nights * rooms_needed

    # 3. Transfers total
    transfers_fee_total = 0.0
    for t in transfers:
        price = float(t.get("price_min") or t.get("price") or 0.0)
        transfers_fee_total += price

    raw_net_subtotal = attractions_fee_total + hotels_fee_total + transfers_fee_total

    # Apply margin config
    if margin_config:
        margin_pct = margin_config.margin_value if margin_config.margin_type == "percentage" else 0.0
        tax_pct = margin_config.tax_rate_percent or 0.0
        margin_amount = raw_net_subtotal * (margin_pct / 100.0)
        tax_amount = (raw_net_subtotal + margin_amount) * (tax_pct / 100.0)
        gross_total = raw_net_subtotal + margin_amount + tax_amount
    else:
        gross_total = raw_net_subtotal

    return {
        "attractions_fee_total": round(attractions_fee_total, 2),
        "hotels_fee_total": round(hotels_fee_total, 2),
        "transfers_fee_total": round(transfers_fee_total, 2),
        "raw_net_subtotal": round(raw_net_subtotal, 2),
        "gross_total": round(gross_total, 2),
        "price_per_person": round(gross_total / travelers, 2)
    }


def generate_whatsapp_proposal_summary(
    client_name: str,
    destination: str,
    duration_days: int,
    num_travelers: int,
    days: List[Dict[str, Any]],
    price_per_person: float,
    proposal_id: Optional[str] = None
) -> str:
    """Formats a client-ready WhatsApp itinerary summary text with pricing."""
    formatted_price = f"₹{price_per_person:,.0f}" if price_per_person else "Custom Quote"
    link = f"https://voyanta.app/p/{proposal_id}" if proposal_id else "https://voyanta.app"

    lines = [
        f"🌟 *Voyanta Travel Proposal for {client_name}*",
        f"📍 Destination: {destination}",
        f"🗓 Duration: {duration_days} Days / {max(1, duration_days - 1)} Nights",
        f"👥 Travelers: {num_travelers} Adults",
        f"💰 Investment: {formatted_price} per person (All inclusive)",
        "",
        "✨ *Trip Highlights:*",
    ]

    for d in days[:5]:
        day_num = d.get("day_number", "")
        title = d.get("title", f"Day {day_num}")
        lines.append(f"• Day {day_num}: {title}")

    lines.extend([
        "",
        f"📄 *View & Customize Full Proposal:* {link}",
        "✨ Crafted with precision by your dedicated travel curator."
    ])

    return "\n".join(lines)


def assemble_master_trip_proposal(
    client_name: str,
    days_per_destination: Dict[str, int],
    retrieved_day_blocks: List[Dict[str, Any]],
    theme_tags: Optional[List[str]] = None,
    num_travelers: int = 2,
    margin_config: Optional[MarginConfig] = None
) -> Dict[str, Any]:
    """
    Synthesizes a master proposal object merging day blocks, destination distribution,
    arithmetic costing, and WhatsApp-ready formatting.
    """
    days = []
    day_counter = 1

    for block in retrieved_day_blocks:
        dest = block.get("destination", "Destination")
        seq = block.get("attractions_sequence", [])
        activities = [{"name": s.replace("_", " ").title(), "timing": "10:00 AM"} for s in seq]
        days.append({
            "day_number": day_counter,
            "title": f"Day {day_counter}: Exploring {dest}",
            "description": f"Full day exploration of key attractions in {dest}.",
            "sub_destination": dest,
            "activities": activities,
            "hotels": [{"name": f"Boutique Hotel in {dest}", "price_per_night": 3500.0, "location": dest}],
            "transfers": [],
            "meals": ["Breakfast"]
        })
        day_counter += 1

    duration_days = len(days)
    hotels_data = [{"price_min": 3500.0, "nights": 1} for _ in days]
    transfers_data = [{"price_min": 2500.0}]

    costing = calculate_exact_trip_arithmetic(
        days=days,
        hotels=hotels_data,
        transfers=transfers_data,
        num_travelers=num_travelers,
        margin_config=margin_config
    )

    dest_names = " & ".join(days_per_destination.keys()) if days_per_destination else "Incredible Journey"
    whatsapp_summary = generate_whatsapp_proposal_summary(
        client_name=client_name,
        destination=dest_names,
        duration_days=duration_days,
        num_travelers=num_travelers,
        days=days,
        price_per_person=costing["price_per_person"],
        proposal_id="prop_master_auto"
    )

    proposal = {
        "name": f"{dest_names} Itinerary for {client_name}",
        "destination": dest_names,
        "duration_days": duration_days,
        "total_price": costing["gross_total"],
        "price_per_person": costing["price_per_person"],
        "currency": "INR",
        "overview": f"Curated {duration_days}-day travel itinerary for {client_name}.",
        "days": days,
        "inclusions": ["Accommodation", "Daily Breakfast", "Sightseeing & Transfers", "All Taxes"],
        "exclusions": ["Airfare", "Personal Expenses", "Travel Insurance"],
        "extra_sections": {}
    }

    return {
        "proposal": proposal,
        "whatsapp_summary": whatsapp_summary,
        "costing_breakdown": costing
    }
