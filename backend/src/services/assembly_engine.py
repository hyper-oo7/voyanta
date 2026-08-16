"""
assembly_engine.py — 1-Shot Deterministic Itinerary Assembly Engine
=====================================================================
Composes complete, costed, and branded proposals from Day Modules,
Vault Hotel Rates, Feasibility Rules, and Margin configurations.
Runs deterministically in under 1.5 seconds.
"""

import logging
from typing import List, Dict, Any, Optional
from src.models.proposal_schema import (
    FinalProposalSchema, ProposalDay, ProposalHotel,
    ProposalActivity, ProposalTransfer, ProposalMeal, ProposalExtraSections
)
from src.models.day_module_schema import MarginConfig
from src.services.margin_service import calculate_full_budget_costing
from src.services.day_module_cache_service import get_cached_day_modules, get_cached_distance
from src.services.travel_rules_service import (
    validate_destination_feasibility,
    apply_pace_and_weather_adjustments,
    filter_by_preferences
)

logger = logging.getLogger(__name__)

# Baseline Seed Day Modules Store (Guarantees zero-failure fallback)
BASELINE_DAY_MODULES: List[Dict[str, Any]] = [
    # --- MANALI & HIMACHAL ---
    {
        "id": "mod_manali_1",
        "destination": "Himachal",
        "sub_destination": "Manali",
        "day_number_hint": 1,
        "title": "Arrival in Manali & Old Manali Café Stroll",
        "description": "Check in to hotel, unwind after transit, and explore charming Old Manali cafés, Hadimba Temple & Mall Road in the evening.",
        "pace_tag": "medium",
        "group_tags": ["friends", "couples", "family", "solo"],
        "season_tags": ["summer", "winter"],
        "preference_tags": ["hills", "cafes", "veg_only"],
        "negative_tags": [],
        "activities": [
            {"name": "Hadimba Devi Temple Visit", "timing": "10:00 AM", "duration": "1.5 hrs", "location": "Old Manali", "description": "Historic 16th-century wooden temple nestled in Dhungri pine forest."},
            {"name": "Old Manali Café Hopping & Mall Road", "timing": "04:00 PM", "duration": "3 hrs", "location": "Mall Road", "description": "Relax at riverfacing cafés and shop local Himachali handicrafts."}
        ],
        "hotels": [{"name": "Solang Valley Resort / Snow Valley Resorts", "category": "4 Star", "location": "Manali", "meal_plan": "MAP", "price_per_night": 4500.0}],
        "estimated_transit_hours": 1.5,
        "estimated_cost": 4500.0
    },
    {
        "id": "mod_manali_2",
        "destination": "Himachal",
        "sub_destination": "Solang Valley",
        "day_number_hint": 2,
        "title": "Solang Valley Adventure & Atal Tunnel Excursion",
        "description": "Full day outdoor excursion to Solang Valley for paragliding, ropeway rides, and scenic drive through Atal Tunnel to Sissu, Lahaul.",
        "pace_tag": "fast",
        "group_tags": ["friends", "couples"],
        "season_tags": ["summer", "winter"],
        "preference_tags": ["adventure", "snow"],
        "negative_tags": ["trekking"],
        "activities": [
            {"name": "Solang Valley Paragliding & Ropeway", "timing": "09:30 AM", "duration": "3 hrs", "location": "Solang Valley", "description": "Thrilling paragliding flight and cable car ride overlooking snowpeaks."},
            {"name": "Sissu Waterfall Drive via Atal Tunnel", "timing": "02:00 PM", "duration": "3.5 hrs", "location": "Sissu", "description": "Drive through the 9.02 km engineering marvel Atal Tunnel to Lahaul Valley."}
        ],
        "hotels": [{"name": "Solang Valley Resort", "category": "4 Star", "location": "Manali", "meal_plan": "MAP", "price_per_night": 4500.0}],
        "estimated_transit_hours": 3.0,
        "estimated_cost": 5500.0
    },
    {
        "id": "mod_manali_3",
        "destination": "Himachal",
        "sub_destination": "Kasol",
        "day_number_hint": 3,
        "title": "Kasol & Manikaran Sahib Day Tour",
        "description": "Scenic drive along Parvati River to Kasol village and sacred Manikaran Sahib hot sulfur springs before return departure.",
        "pace_tag": "medium",
        "group_tags": ["friends", "couples", "family"],
        "season_tags": ["summer", "winter"],
        "preference_tags": ["rivers", "spiritual", "veg_only"],
        "negative_tags": [],
        "activities": [
            {"name": "Manikaran Sahib Hot Springs", "timing": "11:00 AM", "duration": "2 hrs", "location": "Manikaran", "description": "Sacred Gurudwara famous for natural hot sulfur medicinal springs."},
            {"name": "Kasol Parvati Riverfront Relax", "timing": "03:00 PM", "duration": "2.5 hrs", "location": "Kasol", "description": "Riverside walk and Israeli cuisine cafés."}
        ],
        "hotels": [],
        "estimated_transit_hours": 4.0,
        "estimated_cost": 2500.0
    },
    # --- MEGHALAYA & SHILLONG ---
    {
        "id": "mod_shillong_1",
        "destination": "Meghalaya",
        "sub_destination": "Shillong",
        "day_number_hint": 1,
        "title": "Arrival in Shillong via Umiam Lake",
        "description": "Drive from Guwahati airport/station along scenic Umiam Lake (Barapani) to Shillong. Check-in and evening Police Bazaar market stroll.",
        "pace_tag": "slow",
        "group_tags": ["family", "couples", "friends", "solo"],
        "season_tags": ["summer", "monsoon", "winter"],
        "preference_tags": ["lakes", "hills", "veg_only"],
        "negative_tags": [],
        "activities": [
            {"name": "Umiam Lake Viewpoint", "timing": "12:00 PM", "duration": "1 hr", "location": "Umiam", "description": "Picturesque reservoir surrounded by pine-covered hills."},
            {"name": "Police Bazaar Evening Market", "timing": "05:00 PM", "duration": "2 hrs", "location": "Shillong", "description": "Vibrant local marketplace famous for handlooms and local street food."}
        ],
        "hotels": [{"name": "Ri Kynjai - Serenity by the Lake", "category": "Luxury Resort", "location": "Shillong", "meal_plan": "CP", "price_per_night": 8500.0}],
        "estimated_transit_hours": 3.0,
        "estimated_cost": 8500.0
    },
    {
        "id": "mod_shillong_2",
        "destination": "Meghalaya",
        "sub_destination": "Cherrapunji",
        "day_number_hint": 2,
        "title": "Cherrapunji Waterfalls & Mawsmai Cave",
        "description": "Excursion to Sohra (Cherrapunji) featuring Nohkalikai Waterfalls, Seven Sisters Falls, and natural limestone Mawsmai Caves.",
        "pace_tag": "medium",
        "group_tags": ["family", "couples", "friends"],
        "season_tags": ["summer", "monsoon"],
        "preference_tags": ["waterfalls", "caves"],
        "negative_tags": ["trekking"],
        "activities": [
            {"name": "Nohkalikai Falls Viewpoint", "timing": "10:30 AM", "duration": "1.5 hrs", "location": "Cherrapunji", "description": "India's tallest plunge waterfall dropping 1,115 feet into turquoise pool."},
            {"name": "Mawsmai Limestone Cave Exploration", "timing": "02:00 PM", "duration": "1.5 hrs", "location": "Cherrapunji", "description": "Lit natural cave system with fascinating stalactite formations."}
        ],
        "hotels": [{"name": "Polo Towers Shillong", "category": "4 Star", "location": "Shillong", "meal_plan": "CP", "price_per_night": 6500.0}],
        "estimated_transit_hours": 3.5,
        "estimated_cost": 6500.0
    }
]

# Well-known excursion hubs, used to give generic day plans a real sub-destination
# name instead of repeating the primary destination for every single day.
DESTINATION_SUB_HUBS: Dict[str, List[str]] = {
    "ladakh": ["Leh", "Nubra Valley", "Pangong Tso", "Leh"],
    "leh": ["Leh", "Nubra Valley", "Pangong Tso", "Leh"],
    "kashmir": ["Srinagar", "Gulmarg", "Pahalgam", "Srinagar"],
    "srinagar": ["Srinagar", "Gulmarg", "Pahalgam", "Srinagar"],
    "rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Jaisalmer"],
    "jaipur": ["Jaipur", "Amer", "Jaipur"],
    "kerala": ["Kochi", "Munnar", "Thekkady", "Alleppey"],
    "munnar": ["Munnar", "Thekkady", "Alleppey"],
    "goa": ["North Goa", "South Goa", "Panaji"],
    "himachal": ["Manali", "Solang Valley", "Kasol"],
    "meghalaya": ["Shillong", "Cherrapunji", "Dawki"],
    "andaman": ["Port Blair", "Havelock Island", "Neil Island"],
    "sikkim": ["Gangtok", "Tsomgo Lake", "Pelling"],
    "dubai": ["Dubai City", "Desert Safari Camp", "Abu Dhabi"],
    "bali": ["Kuta", "Ubud", "Nusa Penida"],
    "thailand": ["Bangkok", "Pattaya", "Phuket"],
    "singapore": ["Singapore City", "Sentosa Island"],
}

# Rotating day themes for destinations with no seeded module. Correct-but-generic
# beats specific-but-wrong (a Ladakh trip must never describe Hadimba Temple).
_GENERIC_DAY_THEMES: List[Dict[str, Any]] = [
    {
        "title": "Arrival in {place} & Leisure Evening",
        "description": "Arrive in {place} and transfer to your hotel. After check-in and some time to freshen up, step out for a relaxed evening exploring the local markets, cafés and neighbourhood landmarks at your own pace.",
        "activities": [
            {"name": "Hotel Check-in & Welcome Briefing", "timing": "01:00 PM", "duration": "1 hr", "description": "Meet your travel representative for a short briefing on the days ahead."},
            {"name": "Local Market & Neighbourhood Walk", "timing": "05:00 PM", "duration": "2 hrs", "description": "An easy introductory stroll through the most popular local streets and markets."},
        ],
        "transit": 1.5,
    },
    {
        "title": "{place} Signature Sightseeing",
        "description": "A full day covering the most iconic sights of {place} with a private vehicle and driver at your disposal throughout the day.",
        "activities": [
            {"name": "Guided City Highlights Tour", "timing": "09:30 AM", "duration": "4 hrs", "description": "Cover the landmark monuments, viewpoints and photo stops that define the region."},
            {"name": "Popular Viewpoint & Sunset Stop", "timing": "04:30 PM", "duration": "2 hrs", "description": "Wind down at a celebrated viewpoint for golden-hour photographs."},
        ],
        "transit": 2.0,
    },
    {
        "title": "{place} Excursion & Local Culture",
        "description": "Head out on a scenic excursion around {place}, taking in the natural attractions and cultural landmarks that the area is best known for.",
        "activities": [
            {"name": "Scenic Excursion Drive", "timing": "09:00 AM", "duration": "4 hrs", "description": "A picturesque drive with planned halts at the finest vantage points en route."},
            {"name": "Heritage & Craft Experience", "timing": "03:00 PM", "duration": "2 hrs", "description": "Visit a heritage site or local craft cluster for a taste of regional culture."},
        ],
        "transit": 3.0,
    },
    {
        "title": "Leisure Day & Optional Activities in {place}",
        "description": "A deliberately relaxed day in {place}. Choose from optional adventure or wellness activities, or simply unwind at the property.",
        "activities": [
            {"name": "Optional Activities (On Request)", "timing": "10:00 AM", "duration": "3 hrs", "description": "Curated optional experiences can be arranged on request at additional cost."},
            {"name": "Leisure Time at Hotel", "timing": "03:00 PM", "duration": "3 hrs", "description": "Time at leisure to enjoy the hotel facilities or explore independently."},
        ],
        "transit": 1.0,
    },
]

_DEPARTURE_THEME: Dict[str, Any] = {
    "title": "Departure from {place}",
    "description": "After breakfast, check out from the hotel and transfer to the airport / railway station for your onward journey, carrying back memories of {place}.",
    "activities": [
        {"name": "Breakfast & Hotel Check-out", "timing": "08:30 AM", "duration": "1.5 hrs", "description": "Enjoy a relaxed breakfast before completing check-out formalities."},
        {"name": "Departure Transfer", "timing": "11:00 AM", "duration": "2 hrs", "description": "Assisted transfer to the airport or railway station for your onward journey."},
    ],
    "transit": 2.0,
}


# Hotel meal-plan codes -> the meals actually included in the tariff.
_MEAL_PLAN_INCLUSIONS: Dict[str, List[str]] = {
    "EP": [],
    "CP": ["Breakfast"],
    "AP": ["Breakfast", "Lunch", "Dinner"],
    "MAP": ["Breakfast", "Dinner"],
    "APAI": ["Breakfast", "Lunch", "Dinner"],
}


def _format_duration(value: Any) -> str:
    """
    Normalises a duration to a display string. Vault activities carry a numeric
    `duration_hours`, but ProposalActivity.duration is a string — passing the raw
    float through fails validation.
    """
    if value in (None, ""):
        return "2 hrs"
    if isinstance(value, (int, float)):
        hours = float(value)
        if hours <= 0:
            return "2 hrs"
        return f"{hours:g} hr" if hours == 1 else f"{hours:g} hrs"
    return str(value)


def _vehicle_for(num_travelers: int) -> str:
    """Picks a sensible vehicle class for the group size."""
    if num_travelers <= 3:
        return "Sedan (Swift Dzire or similar)"
    if num_travelers <= 6:
        return "SUV (Innova Crysta or similar)"
    if num_travelers <= 12:
        return "Tempo Traveller"
    return "Luxury Coach"


def _build_meals(
    hotels: List[ProposalHotel],
    preferences_text: str,
    breakfast_only: bool = False,
) -> List[ProposalMeal]:
    """
    Derives the day's included meals from the hotel meal plan. Without this the
    meals section renders empty on every generated proposal.

    `breakfast_only` covers the departure day: the guest checks out in the morning,
    so only the breakfast from the previous night's stay applies.
    """
    if not hotels:
        return []

    # Accepts either ProposalHotel models (deterministic engine) or plain dicts
    # (agentic path), so both assembly routes can share this logic.
    hotel = hotels[0]
    if isinstance(hotel, dict):
        hotel_name = hotel.get("name") or "Hotel"
        raw_plan = hotel.get("meal_plan") or hotel.get("meal_type")
    else:
        hotel_name = hotel.name
        raw_plan = hotel.meal_plan

    plan = (raw_plan or "MAP").upper().strip()
    included = _MEAL_PLAN_INCLUSIONS.get(plan, ["Breakfast", "Dinner"])
    if breakfast_only:
        included = [m for m in included if m == "Breakfast"]

    prefs = (preferences_text or "").lower()
    if "vegan" in prefs:
        cuisine = "Vegan"
    elif "veg" in prefs or "jain" in prefs:
        cuisine = "Pure Vegetarian"
    else:
        cuisine = "Multi-cuisine"

    notes = f"Included in the {plan} meal plan."
    return [
        ProposalMeal(
            meal_type=meal,
            venue=hotel_name,
            cuisine=cuisine,
            notes=notes,
        )
        for meal in included
    ]


def _build_transfers(
    day_number: int,
    duration_days: int,
    sub_destination: str,
    previous_sub_destination: Optional[str],
    transit_hours: float,
    num_travelers: int,
) -> List[ProposalTransfer]:
    """
    Derives the day's transfer segments from the itinerary shape. Without this the
    transfers section renders empty on every generated proposal.
    """
    vehicle = _vehicle_for(num_travelers)
    transfers: List[ProposalTransfer] = []

    if day_number == 1:
        transfers.append(ProposalTransfer(
            transfer_type="Arrival Transfer",
            vehicle=vehicle,
            from_location="Airport / Railway Station",
            to=sub_destination,
            timing="On arrival",
            notes="Assisted meet-and-greet on arrival, followed by transfer to the hotel.",
        ))
    elif previous_sub_destination and previous_sub_destination != sub_destination:
        cached = get_cached_distance(previous_sub_destination, sub_destination)
        if cached:
            distance_note = f"Approx. {cached.get('distance_km')} km · {cached.get('transit_hours')} hrs by road."
        else:
            distance_note = f"Approx. {transit_hours} hrs by road."
        transfers.append(ProposalTransfer(
            transfer_type="Inter-city Transfer",
            vehicle=vehicle,
            from_location=previous_sub_destination,
            to=sub_destination,
            timing="09:00 AM",
            notes=distance_note,
        ))
    elif not (duration_days > 1 and day_number == duration_days):
        # Skipped on the departure day, where the departure transfer below is the
        # only movement that actually happens.
        transfers.append(ProposalTransfer(
            transfer_type="Sightseeing Transfer",
            vehicle=vehicle,
            from_location=sub_destination,
            to=sub_destination,
            timing="09:00 AM",
            notes=f"Vehicle at disposal for the day's sightseeing (approx. {transit_hours} hrs running).",
        ))

    if duration_days > 1 and day_number == duration_days:
        transfers.append(ProposalTransfer(
            transfer_type="Departure Transfer",
            vehicle=vehicle,
            from_location=sub_destination,
            to="Airport / Railway Station",
            timing="As per flight schedule",
            notes="Timed to your onward flight or train departure.",
        ))

    return transfers


def _sub_hubs_for(destination: str) -> List[str]:
    """Known excursion bases for a destination, falling back to the destination itself."""
    key = destination.strip().lower()
    for hub_key, hubs in DESTINATION_SUB_HUBS.items():
        if hub_key in key or key in hub_key:
            return hubs
    return [destination]


def _build_generic_module(destination: str, day_number: int, duration_days: int) -> Dict[str, Any]:
    """
    Builds a destination-correct generic day plan. Used when no seeded or cached
    day module exists for the requested destination — emitting another region's
    modules would produce factually wrong itineraries.
    """
    hubs = _sub_hubs_for(destination)
    is_last_day = duration_days > 1 and day_number == duration_days
    # Depart from the gateway hub (first in the list) — that is where the airport or
    # railhead is; departing from a remote excursion base is not realistic.
    place = hubs[0] if is_last_day else hubs[(day_number - 1) % len(hubs)]
    theme = _DEPARTURE_THEME if is_last_day else _GENERIC_DAY_THEMES[(day_number - 1) % len(_GENERIC_DAY_THEMES)]

    return {
        "id": f"generic_{destination.lower().replace(' ', '_')}_{day_number}",
        "destination": destination,
        "sub_destination": place,
        "title": theme["title"].format(place=place),
        "description": theme["description"].format(place=place),
        "activities": [
            {**a, "location": place, "name": a["name"]} for a in theme["activities"]
        ],
        "hotels": [] if is_last_day else [{
            "name": f"Handpicked 4 Star Hotel in {place}",
            "category": "4 Star",
            "location": place,
            "meal_plan": "MAP",
            "price_per_night": 4500.0,
        }],
        "estimated_transit_hours": theme["transit"],
        "estimated_cost": 3500.0 if is_last_day else 4500.0,
    }


def assemble_1shot_proposal(
    destination: str,
    duration_days: int = 3,
    client_name: str = "Valued Traveler",
    group_type: str = "friends",
    pace: str = "medium",
    budget_per_head: float = 25000.0,
    num_travelers: int = 2,
    preferences_text: str = "",
    margin_config: Optional[MarginConfig] = None,
    agency_id: str = "global",
    travel_month: int = 7,
    days_per_destination: Optional[Dict[str, int]] = None,
    # RAG-augmented context — passed from ai_router after retrieval
    rag_context: str = "",
    rag_hotels: List[Dict[str, Any]] = None,
    rag_activities: List[Dict[str, Any]] = None,
) -> FinalProposalSchema:
    """
    1-Shot Assembly Engine: Combines matching Day Modules, Vault Pricing, Feasibility Checks,
    Pace & Weather Protection Rules, and Margins into a valid FinalProposalSchema in < 1.5 seconds.
    """
    logger.info(f"[AssemblyEngine] Assembling 1-Shot proposal for '{destination}' ({duration_days} days, {pace} pace, ₹{budget_per_head}/head, rag_hotels={len(rag_hotels or [])})")

    rag_hotels = rag_hotels or []
    rag_activities = rag_activities or []
    dest_clean = destination.strip().title()
    days_list: List[ProposalDay] = []
    total_net_cost = 0.0

    # 1. Check Destination Pair Feasibility
    sub_dests = [dest_clean]
    is_feasible, warning_msg = validate_destination_feasibility(sub_dests, duration_days, pace)

    # 2. Filter candidate Day Modules from cache or baseline seed
    cached_mods = get_cached_day_modules(agency_id, dest_clean, group_type, pace)
    dest_key = dest_clean.lower()
    if cached_mods:
        raw_candidates = cached_mods
    else:
        # Match on sub_destination too — a "Manali" request must find the Manali
        # module even though the module's destination is "Himachal".
        raw_candidates = [
            m for m in BASELINE_DAY_MODULES
            if dest_key in m["destination"].lower()
            or m["destination"].lower() in dest_key
            or dest_key in (m.get("sub_destination") or "").lower()
            or (m.get("sub_destination") or "").lower() in dest_key
        ]
        # A sub-destination match (e.g. "Manali") would otherwise yield a single module
        # and repeat it every day. Widen to the sibling modules of the same region —
        # they are the standard excursions for that base.
        if raw_candidates:
            parent_destinations = {m["destination"].lower() for m in raw_candidates}
            raw_candidates = [
                m for m in BASELINE_DAY_MODULES
                if m["destination"].lower() in parent_destinations
            ]

    # No module actually covers this destination. Generate destination-correct generic
    # days rather than serving another region's content under the wrong heading.
    use_generic_days = not raw_candidates
    if use_generic_days:
        logger.info(f"[AssemblyEngine] No seeded modules for '{dest_clean}' — building generic destination-correct days.")
        raw_candidates = [
            _build_generic_module(dest_clean, d, duration_days)
            for d in range(1, max(duration_days, 1) + 1)
        ]

    # Apply soft & hard preference filtering (e.g. 'no_trekking', 'veg_only', 'beach').
    # Generic days are already ordered arrival -> departure, and the filter re-sorts by
    # preference score, so it is skipped for them to keep the day sequence coherent.
    candidate_mods = raw_candidates if use_generic_days else filter_by_preferences(raw_candidates, preferences_text)

    # 3. Assemble sequence up to duration_days
    all_packing_items: List[str] = []

    # If days_per_destination is provided, use it to build day_sequence
    day_sequence = []
    if days_per_destination and isinstance(days_per_destination, dict):
        d_num = 1
        for sub_dest, days in days_per_destination.items():
            for _ in range(int(days)):
                day_sequence.append({"day_number": d_num, "sub_destination": sub_dest})
                d_num += 1
    else:
        for d_num in range(1, duration_days + 1):
            day_sequence.append({"day_number": d_num, "sub_destination": None})

    for seq_item in day_sequence:
        d_num = seq_item["day_number"]
        requested_sub = seq_item["sub_destination"]

        # If a specific sub-destination is requested, filter candidate_mods for it
        if requested_sub:
            matching_mods = [m for m in candidate_mods if requested_sub.lower() in m.get("sub_destination", "").lower() or m.get("sub_destination", "").lower() in requested_sub.lower()]
            if matching_mods:
                mod = matching_mods[(d_num - 1) % len(matching_mods)]
            else:
                mod = _build_generic_module(requested_sub, d_num, duration_days)
        else:
            idx = d_num - 1
            mod = candidate_mods[idx] if idx < len(candidate_mods) else _build_generic_module(dest_clean, d_num, duration_days)

        raw_acts = mod.get("activities", [])
        
        # Apply Pace Calibration & Weather Midday Adjustments
        adjusted_acts, packing_additions = apply_pace_and_weather_adjustments(
            raw_acts, dest_clean, travel_month=travel_month, pace=pace
        )
        all_packing_items.extend(packing_additions)

        # --- RAG Override: prefer vault-sourced activities over seed data ---
        if rag_activities:
            # Take up to 3 RAG activities for this day (cycle through them)
            start_idx = (d_num - 1) * 2
            day_rag_acts = rag_activities[start_idx:start_idx + 3]
            if day_rag_acts:
                adjusted_acts = day_rag_acts
                logger.info(f"[AssemblyEngine] Day {d_num}: Using {len(day_rag_acts)} RAG-sourced activities")

        activities = [
            ProposalActivity(
                name=a.get("name", "Sightseeing"),
                duration=_format_duration(a.get("duration") or a.get("duration_hours")),
                timing=a.get("timing", "10:00 AM"),
                location=a.get("location") or mod.get("sub_destination"),
                description=a.get("description", ""),
                price=a.get("price"),
                image_url=a.get("image_url") or "",
            )
            for a in adjusted_acts
        ]

        # Extract hotels — RAG-sourced hotels override seed data
        if rag_hotels:
            # Pick one hotel per day cycling through RAG results
            rag_hotel = rag_hotels[(d_num - 1) % len(rag_hotels)]
            hotels = [
                ProposalHotel(
                    name=rag_hotel.get("name", "Deluxe Resort"),
                    category=rag_hotel.get("category") or rag_hotel.get("star") or "4 Star",
                    location=rag_hotel.get("location") or dest_clean,
                    meal_plan=rag_hotel.get("meal_plan") or rag_hotel.get("meal_type") or "MAP",
                    price_per_night=float(rag_hotel.get("price_per_night") or rag_hotel.get("price_min") or 4000.0),
                    image_url=rag_hotel.get("image_url") or "",
                )
            ]
            logger.info(f"[AssemblyEngine] Day {d_num}: Using RAG-sourced hotel: {rag_hotel.get('name')}")
        else:
            hotels = [
                ProposalHotel(
                    name=h.get("name", "Deluxe Resort"),
                    category=h.get("category", "4 Star"),
                    location=h.get("location", mod.get("sub_destination")),
                    meal_plan=h.get("meal_plan", "MAP"),
                    price_per_night=h.get("price_per_night", 4000.0)
                )
                for h in mod.get("hotels", [])
            ]

        day_sub_dest = mod.get("sub_destination") or dest_clean
        transit_hours = mod.get("estimated_transit_hours", 2)
        is_departure_day = duration_days > 1 and d_num == duration_days

        day_obj = ProposalDay(
            day_number=d_num,
            title=f"Day {d_num}: {mod.get('title', 'Exploration & Sightseeing')}",
            description=mod.get("description", "Enjoy a curated day of sightseeing, leisure, and regional culinary delights."),
            sub_destination=day_sub_dest,
            schedule=f"{pace.title()} pace · {transit_hours} hrs transit",
            hotels=hotels,
            activities=activities,
            meals=_build_meals(
                # Some modules are day trips that carry no hotel of their own (and the
                # departure day has none by design). The guest is still staying at the
                # previous night's property, so derive meals from that rather than
                # rendering an empty meals section.
                hotels or (days_list[-1].hotels if days_list else []),
                preferences_text,
                breakfast_only=is_departure_day,
            ),
            transfers=_build_transfers(
                day_number=d_num,
                duration_days=duration_days,
                sub_destination=day_sub_dest,
                previous_sub_destination=days_list[-1].sub_destination if days_list else None,
                transit_hours=transit_hours,
                num_travelers=num_travelers,
            ),
        )
        days_list.append(day_obj)
        total_net_cost += mod.get("estimated_cost", 3500.0)

    # 4. Calculate Full-Budget Costing & Margins
    costing = calculate_full_budget_costing(
        net_subtotal=total_net_cost * num_travelers,
        margin_config=margin_config,
        num_travelers=num_travelers,
        currency="INR"
    )

    # 5. Build Weather-Aware Extra Sections
    unique_packing = list(dict.fromkeys(all_packing_items))
    packing_str = f"Recommended essentials for {dest_clean}: " + ", ".join(unique_packing) if unique_packing else "Comfortable walking shoes, sunscreen SPF 50+, and casual attire."

    extra_sections = ProposalExtraSections(
        what_to_pack=packing_str,
        important_notes=warning_msg if warning_msg else "Please carry a valid government-issued photo ID (Aadhaar / Passport / Voter ID). Check-in time is 12:00 PM.",
        cancellation_policy="Full refund if cancelled 15 days prior to arrival date. 50% refund 7-14 days prior.",
        terms_of_payment="50% advance deposit to confirm reservation. Remaining balance due 7 days prior to check-in.",
        dos_and_donts="Do respect local cultural sites. Don't litter or carry single-use plastic in eco-sensitive zones."
    )

    # Top-level hotel summary table — deduped across days, preserving itinerary order.
    summary_hotels: List[ProposalHotel] = []
    seen_hotels = set()
    for day in days_list:
        for hotel in day.hotels:
            key = (hotel.name or "").strip().lower()
            if key and key not in seen_hotels:
                seen_hotels.add(key)
                summary_hotels.append(hotel)

    # Preserve itinerary order for sub-destinations; set() scrambled them.
    ordered_sub_dests = list(dict.fromkeys(d.sub_destination for d in days_list if d.sub_destination))

    proposal = FinalProposalSchema(
        destination=dest_clean,
        sub_destinations=ordered_sub_dests,
        hotels=summary_hotels,
        overview=f"Exclusive {duration_days}-Day curated trip to {dest_clean} customized for {client_name}." + (
            f" Built from your agency's vault knowledge." if rag_hotels or rag_activities else ""
        ),
        duration_days=duration_days,
        currency="INR",
        total_price=costing.final_package_total,
        price_per_person=costing.price_per_person,
        days=days_list,
        inclusions=["Private AC Vehicle for all transfers & sightseeing", "Hotel Accommodation with breakfast & dinner", "All toll, parking, driver allowances & taxes"],
        exclusions=["Airfare / Train tickets", "Personal expenses & tips", "Monument entry fees & adventure activity charges"],
        extra_sections=extra_sections,
        model_used="1-Shot RAG-Augmented Assembly v3.0" if (rag_hotels or rag_activities) else "1-Shot Deterministic Engine v2.0 (Feasibility & Weather Enabled)"
    )

    return proposal
