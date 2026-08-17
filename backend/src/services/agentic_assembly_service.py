import json
import math
import logging
from typing import Dict, Any

from src.models.assembly_schemas import (
    AssembleRequest,
    VaultMatches,
    CostingPrefs,
    AssembledProposalOut,
)
from src.services.assembly_engine import _build_meals, _build_transfers

logger = logging.getLogger(__name__)


# ── Prompt Builder ─────────────────────────────────────────────────

def _build_prompt(req: AssembleRequest) -> str:
    vault = req.vault_matches
    hotels = vault.hotels
    activities = vault.activities
    flights = vault.flights
    templates = vault.templates
    chunks = req.rag_context.chunks
    query = req.rag_context.assembled_query or ""

    catalog = []
    if hotels:
        catalog.append("HOTELS (use ONLY these IDs):")
        for h in hotels:
            catalog.append(
                f"  [{h.id}] {h.name} | {h.location or 'N/A'} | "
                f"₹{h.price_per_night or 0}/night | {h.category or 'N/A'} | Meal:{h.meal_type or 'CP'}"
            )

    if activities:
        catalog.append("\nACTIVITIES (use ONLY these IDs):")
        for a in activities:
            catalog.append(
                f"  [{a.id}] {a.name} | {a.location or 'N/A'} | "
                f"₹{a.price or 0} | {a.duration_hours or '?'}h | {a.type or 'Activity'}"
            )

    if flights:
        catalog.append("\nFLIGHTS (use ONLY these IDs):")
        for f in flights:
            catalog.append(
                f"  [{f.id}] {f.airline} {f.flight_no or 'N/A'} | "
                f"{f.origin or '?'}→{f.destination or '?'} | ₹{f.cost or 0} | {f.class_ or 'Economy'}"
            )

    if templates:
        catalog.append("\nPAST TEMPLATES (for style reference only):")
        for t in templates[:3]:
            catalog.append(f"  [{t.id}] {t.name} | {t.destination or 'N/A'} | {t.days or '?'} days")

    rag_section = ""
    if chunks:
        rag_section = "\nRELEVANT SUPPLIER DOCUMENTS:\n"
        for i, c in enumerate(chunks[:6], 1):
            src = c.source or "Document"
            rag_section += f"[{i}] {src}: {c.text[:700]}\n"

    catalog_block = "\n".join(catalog)

    is_corporate = req.group_type == "corporate"

    child_str = ""
    if req.num_children > 0:
        ages = ", ".join(str(a) for a in req.child_ages) if req.child_ages else "ages not specified"
        child_str = f"  - Children: {req.num_children} (ages: {ages}) — apply extra bed supplements\n"

    corporate_str = ""
    if is_corporate:
        corporate_str = f"""
CORPORATE TRIP REQUIREMENTS:
  - Company: {req.company_name or 'Not specified'}
  - GSTIN: {req.gstin or 'Not specified'}
  - GST Invoice Required: {'Yes — add GST line item in exclusions and notes' if req.requires_gst_invoice else 'No'}
  - Room Arrangement: {'Single occupancy (NO room sharing). Add single supplement cost.' if req.single_room_supplement else req.room_preference}
  - Early Check-in: {'Required — factor into Day 1 logistics' if req.early_checkin_required else 'Not required'}
  - Late Checkout: {'Required — factor into last day logistics' if req.late_checkout_required else 'Not required'}
  - Meeting Room: {'Required — include in hotel selection criteria' if req.meeting_room_required else 'Not required'}
  - Cancellation Terms: {'Use strict 30-day cancellation policy in terms section' if req.corporate_cancellation_terms else 'Standard'}
  NOTE: This is a CORPORATE itinerary. Prioritize business hotels with conference facilities, executive floors, and branded properties. Exclude leisure/couple activities. Include team-building options. Add corporate-appropriate inclusions/exclusions.
"""

    prompt = f"""You are Voyanta, an expert B2B travel itinerary assembler.
Your job is to build a day-by-day itinerary using ONLY the inventory provided below.
NEVER invent hotel names, activity names, flight numbers, or IDs that are not in the catalog.

CLIENT BRIEF:
  - Client: {req.client_name}
  - Destination: {req.destination}
  - Group Type: {req.group_type.upper()}
  - Duration: {req.duration_days} days ({req.start_date or 'TBD'} to {req.end_date or 'TBD'})
  - Adults: {req.num_travelers}
{child_str}  - Budget per head: ₹{req.budget_per_head or 'Not specified'} ({req.budget_flexibility} — {'Do NOT exceed budget' if req.budget_flexibility == 'strict' else 'Can go 10-15% over for exceptional experiences'})
  - Hotel Category: {req.hotel_category.replace('_', ' ').title()} — select hotels matching this category ONLY
  - Flight Class: {req.flight_class.title()} — use this class for all flights in the itinerary
  - Transport: {req.transport_type.replace('_', ' ').title()}
  - Dietary: {req.dietary or 'No restrictions'}
  - Travel Style / Pace: {req.pace or 'balanced'}
  - Arrival: {req.arrival_city or 'TBD'} ({req.arrival_airport or ''})
  - Departure: {req.departure_city or 'TBD'} ({req.departure_airport or ''})
  - Special Requests: {req.special_notes or 'None'}
{corporate_str}

{"RAG Query: " + query if query else ""}

{rag_section}

AVAILABLE INVENTORY:
{catalog_block}

RULES:
1. Create EXACTLY {req.duration_days} days.
2. Day 1 must include arrival logistics (flight if available, hotel check-in).
3. Day {req.duration_days} must include departure logistics (flight if available).
4. Use the SAME hotel for consecutive nights unless the brief explicitly requires moving.
5. Distribute 2–4 activities per day depending on pace (relaxed=2, medium=3, fast=4).
6. Every hotel, activity, and flight MUST use an ID from the catalog above.
7. Do NOT hallucinate prices — use the exact prices shown in the catalog.
8. If no flights exist in the catalog, omit the flights array entirely.
9. If no hotels exist, set status to "insufficient_inventory" and explain why.
10. Write engaging, professional descriptions suitable for a client proposal.
11. Include realistic meal plans based on hotel meal_type (CP=breakfast, MAP=breakfast+dinner, AP=all meals).
12. Return ONLY valid JSON. No markdown, no explanations outside JSON.

COSTING (backend will recalculate — include rough estimates):
- Markup: {req.costing_prefs.pct_markup}%
- Tax/GST: {req.costing_prefs.tax}%
- Discount: ₹{req.costing_prefs.discount}

OUTPUT JSON SCHEMA:
{{
  "status": "success",
  "proposal": {{
    "name": "string",
    "destination": "string",
    "duration_days": int,
    "total_price": float,
    "price_per_person": float,
    "currency": "INR",
    "overview": "2-3 sentence overview",
    "days": [
      {{
        "day_number": int,
        "title": "Day title",
        "description": "Rich paragraph description",
        "sub_destination": "string or null",
        "hotels": [{{ "id": "EXACT_ID", "name": "EXACT_NAME", "category": "string", "meal_plan": "CP/MAP/AP", "price_per_night": float, "location": "string", "image_url": "string or null" }}],
        "activities": [{{ "id": "EXACT_ID", "name": "EXACT_NAME", "duration": "X hrs", "timing": "HH:MM AM/PM", "price": float, "location": "string", "description": "string" }}],
        "flights": [{{ "id": "EXACT_ID", "airline": "string", "flight_no": "string", "origin": "string", "destination": "string", "cost": float, "class": "Economy/Business/First" }}],
        "transfers": [],
        "meals": ["Breakfast", "Dinner"],
        "day_total": float
      }}
    ],
    "inclusions": ["string"],
    "exclusions": ["string"],
    "extra_sections": {{}}
  }}
}}
"""
    return prompt


# ── LLM Call ───────────────────────────────────────────────────────

async def _call_llm_async(prompt: str) -> Dict[str, Any]:
    """
    Routed through the shared ai_client so we inherit provider cascading
    (Gemini -> OpenAI), retries and caching. The OpenAI SDK is deliberately not
    used directly here: its sync client blocked the event loop for the whole
    generation, and `openai` is not a declared dependency of this service.
    """
    from src.services.ai_client import call_llm

    res_str = await call_llm(
        prompt=prompt,
        system_prompt=(
            "You are a strict JSON-only travel itinerary assembler. "
            "You never hallucinate inventory. You only use provided IDs and names."
        ),
        temperature=0.25,
        response_schema={"type": "object"},
        max_tokens=32768,
    )
    if not res_str:
        raise ValueError("LLM returned empty content")

    clean_str = res_str.strip()
    if clean_str.startswith("```"):
        clean_str = clean_str.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        return json.loads(clean_str)
    except json.JSONDecodeError:
        from src.services.json_utils import loads_forgiving
        return loads_forgiving(clean_str)


# ── Validation & Cost Calculation ──────────────────────────────────

def _validate_and_price(
    raw: Dict[str, Any],
    vault: VaultMatches,
    costing: CostingPrefs,
    travelers: int,
    req: AssembleRequest,
) -> Dict[str, Any]:
    """Ensure every ID exists in vault and recalculate all math exactly."""

    hotel_map = {h.id: h for h in vault.hotels}
    activity_map = {a.id: a for a in vault.activities}
    flight_map = {f.id: f for f in vault.flights}

    proposal = raw.get("proposal")
    if not proposal:
        raise ValueError("LLM response missing proposal object")

    days = proposal.get("days", [])
    total_base = 0.0

    for day in days:
        day_base = 0.0

        # Hotels
        validated_hotels = []
        for h in day.get("hotels", []):
            vault_h = hotel_map.get(h.get("id"))
            if not vault_h:
                # If LLM returned a hotel not in map, try soft name matching or error out
                matched = next((vh for vh in vault.hotels if vh.name.lower() in h.get("name", "").lower()), None)
                if matched:
                    vault_h = matched
                else:
                    raise ValueError(f"LLM hallucinated hotel ID/name: {h.get('id')} ({h.get('name')})")
            price = float(vault_h.price_per_night or 0)
            day_base += price
            validated_hotels.append({
                "id": vault_h.id,
                "name": vault_h.name,
                "category": vault_h.category or req.hotel_category.replace('_', ' ').title(),
                "meal_plan": vault_h.meal_type or "CP",
                "price_per_night": price,
                "location": vault_h.location or "",
                "image_url": vault_h.image_url,
            })
        day["hotels"] = validated_hotels

        # Activities
        validated_activities = []
        for a in day.get("activities", []):
            vault_a = activity_map.get(a.get("id"))
            if not vault_a:
                matched = next((va for va in vault.activities if va.name.lower() in a.get("name", "").lower()), None)
                if matched:
                    vault_a = matched
                else:
                    raise ValueError(f"LLM hallucinated activity ID/name: {a.get('id')} ({a.get('name')})")
            price = float(vault_a.price or 0)
            day_base += price * max(1, travelers)
            validated_activities.append({
                "id": vault_a.id,
                "name": vault_a.name,
                "duration": a.get("duration") or f"{vault_a.duration_hours or 3} hrs",
                "timing": a.get("timing") or "10:00 AM",
                "price": price,
                "location": vault_a.location or "",
                "description": a.get("description") or vault_a.description or "",
            })
        day["activities"] = validated_activities

        # Flights
        validated_flights = []
        for f in day.get("flights", []):
            vault_f = flight_map.get(f.get("id"))
            if not vault_f:
                matched = next((vf for vf in vault.flights if vf.airline.lower() in f.get("airline", "").lower()), None)
                if matched:
                    vault_f = matched
                else:
                    raise ValueError(f"LLM hallucinated flight ID: {f.get('id')}")
            price = float(vault_f.cost or 0)
            day_base += price * max(1, travelers)
            validated_flights.append({
                "id": vault_f.id,
                "airline": vault_f.airline,
                "flight_no": vault_f.flight_no or "TBD",
                "origin": vault_f.origin or "",
                "destination": vault_f.destination or "",
                "cost": price,
                "class": vault_f.class_ or req.flight_class.title(),
            })
        day["flights"] = validated_flights

        # The LLM is not reliable for these two sections — the prompt templates
        # transfers as an empty array, and returns meals as bare strings that the UI
        # cannot render. Derive both deterministically so they are always populated
        # and always in the shape the frontend expects.
        day_number = int(day.get("day_number") or 0) or (days.index(day) + 1)
        day_sub_dest = day.get("sub_destination") or req.destination
        previous_sub_dest = days[days.index(day) - 1].get("sub_destination") if days.index(day) > 0 else None
        is_departure_day = len(days) > 1 and day_number == len(days)

        meal_hotels = validated_hotels
        if not meal_hotels and is_departure_day and days.index(day) > 0:
            meal_hotels = days[days.index(day) - 1].get("hotels") or []

        day["meals"] = [
            m.model_dump(by_alias=True)
            for m in _build_meals(meal_hotels, req.special_notes or "", breakfast_only=is_departure_day)
        ]
        if not day.get("transfers"):
            day["transfers"] = [
                t.model_dump(by_alias=True)
                for t in _build_transfers(
                    day_number=day_number,
                    duration_days=len(days),
                    sub_destination=day_sub_dest,
                    previous_sub_destination=previous_sub_dest,
                    transit_hours=2,
                    num_travelers=max(1, travelers),
                )
            ]
        day["day_total"] = round(day_base, 2)
        total_base += day_base

    # Apply costing rules
    markup_pct = float(costing.pct_markup or 15)
    tax_pct = float(costing.tax or 5)
    discount = float(costing.discount or 0)

    markup_amount = total_base * (markup_pct / 100)
    tax_amount = (total_base + markup_amount) * (tax_pct / 100)
    total = total_base + markup_amount + tax_amount - discount
    total = max(0, math.ceil(total))

    proposal["total_price"] = total
    proposal["price_per_person"] = math.ceil(total / max(1, travelers))
    proposal["currency"] = "INR"

    proposal.setdefault("inclusions", [
        "Private AC vehicle for all transfers & sightseeing",
        "Accommodation as per itinerary",
        "Daily breakfast at hotel",
        "All applicable taxes",
    ])
    proposal.setdefault("exclusions", [
        "Airfare / train fare",
        "Personal expenses & tips",
        "Travel insurance",
        "Anything not mentioned in inclusions",
    ])
    proposal.setdefault("extra_sections", {})

    return raw


# ── Public Entrypoint ──────────────────────────────────────────────

async def assemble_itinerary(req: AssembleRequest) -> AssembledProposalOut:
    """Full pipeline: prompt → LLM → validate → price → return."""

    vm = req.vault_matches
    has_inventory = bool(vm.hotels or vm.activities or vm.flights)
    if not has_inventory:
        logger.warning(f"[AgenticAssembly] No vault inventory found for {req.destination}. Falling back to deterministic engine.")
        # We raise ValueError here so the router can catch it and route to the fallback engine.
        raise ValueError(
            f"No vault inventory found for {req.destination}. "
            "Please upload supplier PDFs or add resources to your library."
        )

    # 1. Build prompt
    prompt = _build_prompt(req)

    # 2. Call LLM
    raw = await _call_llm_async(prompt)

    # 3. Handle explicit insufficient inventory from LLM
    if raw.get("status") == "insufficient_inventory":
        raise ValueError(raw.get("detail", "LLM reported insufficient inventory"))

    # 4. Validate IDs and recalculate exact pricing
    priced = _validate_and_price(
        raw,
        vault=req.vault_matches,
        costing=req.costing_prefs,
        travelers=max(1, req.num_travelers),
        req=req,
    )

    # 5. Return
    return AssembledProposalOut(**priced["proposal"])
