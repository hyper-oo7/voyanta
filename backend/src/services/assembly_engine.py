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
    raw_candidates = cached_mods if cached_mods else [
        m for m in BASELINE_DAY_MODULES
        if dest_clean.lower() in m["destination"].lower() or m["destination"].lower() in dest_clean.lower()
    ]
    if not raw_candidates:
        raw_candidates = BASELINE_DAY_MODULES  # Fallback to general baseline

    # Apply soft & hard preference filtering (e.g. 'no_trekking', 'veg_only', 'beach')
    candidate_mods = filter_by_preferences(raw_candidates, preferences_text)

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
                mod = candidate_mods[(d_num - 1) % len(candidate_mods)]
                # Override title/description if no matching module is found
                mod = mod.copy()
                mod["sub_destination"] = requested_sub
                mod["title"] = f"Explore {requested_sub}"
                mod["description"] = f"Enjoy a curated day of sightseeing and experiences in {requested_sub}."
        else:
            mod = candidate_mods[(d_num - 1) % len(candidate_mods)]

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
                duration=a.get("duration") or a.get("duration_hours", "2 hrs"),
                timing=a.get("timing", "10:00 AM"),
                location=a.get("location", mod.get("sub_destination")),
                description=a.get("description", "")
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
                    category=rag_hotel.get("category") or rag_hotel.get("star", "4 Star"),
                    location=rag_hotel.get("location", dest_clean),
                    meal_plan=rag_hotel.get("meal_plan") or rag_hotel.get("meal_type", "MAP"),
                    price_per_night=float(rag_hotel.get("price_per_night") or rag_hotel.get("price_min") or 4000.0)
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

        day_obj = ProposalDay(
            day_number=d_num,
            title=f"Day {d_num}: {mod.get('title', 'Exploration & Sightseeing')}",
            description=mod.get("description", "Enjoy a curated day of sightseeing, leisure, and regional culinary delights."),
            sub_destination=mod.get("sub_destination", dest_clean),
            schedule=f"{pace.title()} pace · {mod.get('estimated_transit_hours', 2)} hrs transit",
            hotels=hotels,
            activities=activities
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

    proposal = FinalProposalSchema(
        destination=dest_clean,
        sub_destinations=list(set(d.sub_destination for d in days_list if d.sub_destination)),
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
