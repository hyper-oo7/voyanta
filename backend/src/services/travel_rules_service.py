"""
travel_rules_service.py — Feasibility, Weather Intelligence & Preference Engine
================================================================================
Enforces sub-destination distance constraints, pace-based activity density,
weather protection protocols (midday sun shifts, gear auto-fill), and soft/hard
client preference filters (beach, no_trekking, veg_only).
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from src.services.day_module_cache_service import get_cached_distance, store_cached_distance

logger = logging.getLogger(__name__)

# Destination Weather Database (Indexed by Destination & Month)
DESTINATION_WEATHER_RULES: Dict[str, Dict[int, Dict[str, Any]]] = {
    "rajasthan": {
        m: {
            "avg_temp_max": 38.0 if m in [4, 5, 6] else 28.0,
            "sun_exposure": "extreme" if m in [4, 5, 6, 7] else "moderate",
            "avoid_midday_outdoors": True if m in [4, 5, 6, 7] else False,
            "packing_additions": ["Sunscreen SPF 50+", "Wide-brim hat & sunglasses", "Breathable cotton attire", "Hydration packs / ORS"],
            "weather_warning": "High summer temperatures. Midday outdoor tours are shifted to morning & evening."
        } for m in range(1, 13)
    },
    "himachal": {
        m: {
            "avg_temp_max": 22.0 if m in [5, 6, 7] else 10.0,
            "sun_exposure": "moderate",
            "avoid_midday_outdoors": False,
            "packing_additions": ["Heavy thermals & fleece jackets", "Windproof gloves & lip balm", "Sturdy walking boots"] if m in [11, 12, 1, 2, 3] else ["Light woolens", "Sunscreen", "Comfortable sneakers"],
            "weather_warning": "Cold mountain weather in winter months." if m in [11, 12, 1, 2, 3] else "Pleasant mountain weather."
        } for m in range(1, 13)
    },
    "meghalaya": {
        m: {
            "avg_temp_max": 24.0,
            "sun_exposure": "low" if m in [6, 7, 8, 9] else "moderate",
            "avoid_midday_outdoors": False,
            "packing_additions": ["Waterproof jacket / poncho", "Non-slip footwear", "Quick-dry clothing", "Mosquito repellent"] if m in [5, 6, 7, 8, 9] else ["Light jacket", "Comfortable walking shoes"],
            "weather_warning": "Heavy monsoon rains expected. Waterproof gear recommended." if m in [5, 6, 7, 8, 9] else "Pleasant hill climate."
        } for m in range(1, 13)
    },
    "kerala": {
        m: {
            "avg_temp_max": 32.0,
            "sun_exposure": "moderate",
            "avoid_midday_outdoors": False,
            "packing_additions": ["Light cotton clothing", "Sunscreen", "Umbrella / rain poncho", "Insect repellent"],
            "weather_warning": "Tropical coastal climate."
        } for m in range(1, 13)
    },
    "leh": {
        m: {
            "avg_temp_max": 18.0 if m in [6, 7, 8] else 5.0,
            "sun_exposure": "extreme",
            "avoid_midday_outdoors": False,
            "packing_additions": ["Thermals & heavy down jacket", "UV sunglasses & high-SPF sunblock", "Portable oxygen cylinder", "Hydration flasks"],
            "weather_warning": "High altitude cold desert. Enforce 24-hour acclimatization on arrival."
        } for m in range(1, 13)
    }
}


def validate_destination_feasibility(
    destinations: List[str],
    duration_days: int,
    pace: str = "medium"
) -> Tuple[bool, Optional[str]]:
    """
    Validates if selected destinations/sub-destinations are geographically feasible
    for the given duration and pace. Returns (is_feasible, warning_or_error_message).
    """
    if len(destinations) <= 1:
        return True, None

    # Maximum sub-destinations allowed for duration
    max_allowed = max(1, int(duration_days / 1.5))
    if len(destinations) > max_allowed:
        return False, f"Visiting {len(destinations)} destinations in {duration_days} days is too rushed for a {pace} pace. Recommended max: {max_allowed} destinations."

    # Check pairwise distance thresholds
    for i in range(len(destinations)):
        for j in range(i + 1, len(destinations)):
            d1, d2 = destinations[i], destinations[j]
            cached = get_cached_distance(d1, d2)
            if cached:
                dist = cached["distance_km"]
                hrs = cached["travel_time_hours"]
                # Threshold check: > 350 km or > 6 hrs travel forbids same-day / short trip pairing
                if dist > 350.0 or hrs > 6.0:
                    if duration_days <= 3:
                        return False, f"Distance between {d1.title()} and {d2.title()} ({dist:.0f} km / {hrs:.1f} hrs) is too far for a {duration_days}-day trip."

    return True, None


def apply_pace_and_weather_adjustments(
    activities: List[Dict[str, Any]],
    destination: str,
    travel_month: int = 7,
    pace: str = "medium"
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Adjusts daily activities and generates weather-specific packing additions based on
    destination micro-climates, midday sun exposure, and pace rules.
    """
    dest_key = destination.strip().lower()
    weather_info = None
    for k, months_dict in DESTINATION_WEATHER_RULES.items():
        if k in dest_key or dest_key in k:
            weather_info = months_dict.get(travel_month)
            break

    if not weather_info:
        weather_info = {
            "sun_exposure": "moderate",
            "avoid_midday_outdoors": False,
            "packing_additions": ["Sunscreen SPF 30+", "Comfortable walking shoes", "Hydration bottle"],
            "weather_warning": "Pleasant travel climate."
        }

    # 1. Pace-based Activity Density Cap
    max_acts = 4 if pace == "fast" else (3 if pace == "medium" else 2)
    adjusted_activities = list(activities[:max_acts])

    # 2. Midday Heat Shift (Avoid 12 PM - 4 PM direct sun exposure in hot summer regions)
    if weather_info.get("avoid_midday_outdoors"):
        for act in adjusted_activities:
            desc = act.get("description", "")
            timing = act.get("timing", "")
            if "12:00" in timing or "13:00" in timing or "14:00" in timing or "15:00" in timing:
                act["timing"] = "09:00 AM (Morning Tour)"
                act["description"] = f"{desc} [Schedule Note: Shifted to morning to avoid peak afternoon summer heat]."

    return adjusted_activities, weather_info.get("packing_additions", [])


def filter_by_preferences(
    day_modules: List[Dict[str, Any]],
    preferences_text: str
) -> List[Dict[str, Any]]:
    """
    Applies soft and hard preference filters on candidate day modules:
    - 'no_trekking': excludes modules with trekking / steep hiking
    - 'beach' / 'hills' / 'veg_only': boosts modules matching preferences
    """
    pref_lower = preferences_text.lower().strip()
    if not pref_lower:
        return day_modules

    filtered = []
    for mod in day_modules:
        neg_tags = mod.get("negative_tags", [])
        pref_tags = mod.get("preference_tags", [])

        # Hard exclusion check: 'no trekking'
        if "no trekking" in pref_lower or "no_trekking" in pref_lower:
            if "trekking" in neg_tags or "hiking" in neg_tags or "trek" in mod.get("title", "").lower():
                continue  # Exclude trekking day module

        # Soft boost matching
        score = 0
        if "beach" in pref_lower and "beach" in pref_tags:
            score += 2
        if "hills" in pref_lower and ("hills" in pref_tags or "hill_station" in pref_tags):
            score += 2
        if "veg" in pref_lower and "veg_only" in pref_tags:
            score += 2

        mod["_pref_score"] = score
        filtered.append(mod)

    # Sort candidates by preference match score
    filtered.sort(key=lambda m: m.get("_pref_score", 0), reverse=True)
    return filtered if filtered else day_modules
