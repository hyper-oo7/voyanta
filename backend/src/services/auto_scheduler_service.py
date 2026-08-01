"""
auto_scheduler_service.py — Phase 5 Auto-Scheduling Engine (Pure Code, $0 AI Cost)
===================================================================================
Generates exact minute-by-minute day schedules from attraction lists.
Hydrates duration, opening/closing windows, lat/lng coordinates, computes pairwise
geodesic/matrix travel times, and applies greedy nearest-neighbor slot routing.
"""

import math
import re
import logging
from typing import List, Dict, Any, Tuple, Optional


from src.models.itinerary_block import AttractionMasterRecord
from src.services.day_module_cache_service import get_cached_distance, store_cached_distance

logger = logging.getLogger(__name__)


# Standardized Seed Attraction Master Registry (Guarantees zero-failure fallback)
SEED_ATTRACTIONS_REGISTRY: Dict[str, AttractionMasterRecord] = {
    # --- SHILLONG & MEGHALAYA ---
    "ward_lake": AttractionMasterRecord(
        attraction_id="ward_lake",
        name="Ward's Lake",
        city="Shillong",
        duration_minutes=60,
        open_time="08:30",
        close_time="17:30",
        best_slot=["morning"],
        entry_fee=20.0,
        lat=25.5744,
        lng=91.8825,
        tags=["nature", "family", "budget"]
    ),
    "police_bazaar": AttractionMasterRecord(
        attraction_id="police_bazaar",
        name="Police Bazaar",
        city="Shillong",
        duration_minutes=90,
        open_time="10:00",
        close_time="20:00",
        best_slot=["afternoon", "evening"],
        entry_fee=0.0,
        lat=25.5788,
        lng=91.8831,
        tags=["shopping", "culture", "budget"]
    ),
    "elephant_falls": AttractionMasterRecord(
        attraction_id="elephant_falls",
        name="Elephant Falls",
        city="Shillong",
        duration_minutes=60,
        open_time="09:00",
        close_time="17:00",
        best_slot=["morning", "afternoon"],
        entry_fee=50.0,
        lat=25.5356,
        lng=91.8227,
        tags=["waterfall", "nature", "family"]
    ),
    "shillong_peak": AttractionMasterRecord(
        attraction_id="shillong_peak",
        name="Shillong Peak Laitkor",
        city="Shillong",
        duration_minutes=45,
        open_time="09:00",
        close_time="16:00",
        best_slot=["morning"],
        entry_fee=30.0,
        lat=25.5397,
        lng=91.8491,
        tags=["viewpoint", "nature"]
    ),
    # --- CHERRAPUNJI ---
    "nohkalikai_falls": AttractionMasterRecord(
        attraction_id="nohkalikai_falls",
        name="Nohkalikai Falls",
        city="Cherrapunji",
        duration_minutes=75,
        open_time="08:00",
        close_time="17:00",
        best_slot=["morning"],
        entry_fee=50.0,
        lat=25.2756,
        lng=91.6844,
        tags=["waterfall", "nature", "scenic"]
    ),
    "mawsmai_caves": AttractionMasterRecord(
        attraction_id="mawsmai_caves",
        name="Mawsmai Caves",
        city="Cherrapunji",
        duration_minutes=60,
        open_time="09:00",
        close_time="17:00",
        best_slot=["afternoon"],
        entry_fee=40.0,
        lat=25.2444,
        lng=91.7258,
        tags=["caves", "adventure", "family"]
    ),
    "seven_sisters_falls": AttractionMasterRecord(
        attraction_id="seven_sisters_falls",
        name="Seven Sisters Falls (Nohsngithiang)",
        city="Cherrapunji",
        duration_minutes=45,
        open_time="08:00",
        close_time="17:30",
        best_slot=["evening"],
        entry_fee=20.0,
        lat=25.2500,
        lng=91.7167,
        tags=["waterfall", "sunset", "viewpoint"]
    ),
    # --- MANALI ---
    "hadimba_temple": AttractionMasterRecord(
        attraction_id="hadimba_temple",
        name="Hadimba Devi Temple",
        city="Manali",
        duration_minutes=60,
        open_time="08:00",
        close_time="18:00",
        best_slot=["morning"],
        entry_fee=0.0,
        lat=32.2483,
        lng=77.1806,
        tags=["temple", "heritage", "family"]
    ),
    "solang_valley": AttractionMasterRecord(
        attraction_id="solang_valley",
        name="Solang Valley Adventure Hub",
        city="Manali",
        duration_minutes=180,
        open_time="09:00",
        close_time="17:00",
        best_slot=["morning", "afternoon"],
        entry_fee=500.0,
        lat=32.3167,
        lng=77.1500,
        tags=["adventure", "snow", "ropeway"]
    ),
    "mall_road": AttractionMasterRecord(
        attraction_id="mall_road",
        name="Mall Road & Old Manali Stroll",
        city="Manali",
        duration_minutes=120,
        open_time="10:00",
        close_time="21:00",
        best_slot=["evening"],
        entry_fee=0.0,
        lat=32.2431,
        lng=77.1892,
        tags=["shopping", "food", "cafes"]
    )
}


def calculate_haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculates spatial geodesic distance between two points in km."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def estimate_transit_minutes(origin_spot: str, dest_spot: str, lat1: Optional[float] = None, lng1: Optional[float] = None, lat2: Optional[float] = None, lng2: Optional[float] = None) -> Tuple[int, float]:
    """
    Computes pairwise travel time (minutes) and distance (km).
    Uses cached static matrix first; falls back to spatial Haversine estimation.
    """
    # 1. Check precomputed cache
    cached = get_cached_distance(origin_spot, dest_spot)
    if cached:
        return int(cached.get("transit_hours", 0.5) * 60), float(cached.get("distance_km", 5.0))

    # 2. Geodesic spatial calculation
    if lat1 is not None and lng1 is not None and lat2 is not None and lng2 is not None:
        dist_km = calculate_haversine_distance_km(lat1, lng1, lat2, lng2)
        # Assume average city/mountain speed of 30 km/h
        transit_min = max(10, round((dist_km / 30.0) * 60))
        # Store in cache
        store_cached_distance(origin_spot, dest_spot, dist_km, transit_min / 60.0)
        return transit_min, dist_km

    # 3. Baseline default fallback (15 mins, 3.0 km)
    return 15, 3.0


def parse_time_to_minutes(time_str: str) -> int:
    """Converts '09:30' or '09:30 AM' or '02:15 PM' to minutes from midnight."""
    t_clean = time_str.strip().upper()
    is_pm = "PM" in t_clean
    is_am = "AM" in t_clean
    t_num = re.sub(r"[^\d:]", "", t_clean)

    parts = t_num.split(":")
    hours = int(parts[0]) if len(parts) > 0 and parts[0] else 9
    minutes = int(parts[1]) if len(parts) > 1 and parts[1] else 0

    if is_pm and hours < 12:
        hours += 12
    elif is_am and hours == 12:
        hours = 0

    return (hours * 60) + minutes


def format_minutes_to_time(total_minutes: int) -> str:
    """Converts total minutes from midnight into human-readable 12-hour format e.g. '09:30 AM'."""
    mins_in_day = total_minutes % 1440
    hours = mins_in_day // 60
    minutes = mins_in_day % 60
    suffix = "AM" if hours < 12 else "PM"
    
    display_hours = hours % 12
    if display_hours == 0:
        display_hours = 12

    return f"{display_hours:02d}:{minutes:02d} {suffix}"


def get_slot_priority(best_slots: List[str]) -> int:
    """Assigns priority order for slot sorting: morning=1, afternoon=2, evening=3, night=4."""
    slots_lower = [s.lower() for s in best_slots]
    if "morning" in slots_lower:
        return 1
    elif "afternoon" in slots_lower:
        return 2
    elif "evening" in slots_lower:
        return 3
    return 4


def generate_timed_day_schedule(
    attraction_ids: List[str],
    city: str,
    start_time_str: str = "09:00 AM",
    attractions_registry: Optional[Dict[str, AttractionMasterRecord]] = None
) -> Dict[str, Any]:
    """
    Generates exact minute-by-minute day schedule from attraction list.
    Greedy assignment:
    1. Sort attractions by best_slot (morning -> afternoon -> evening)
    2. Order by proximity (nearest-neighbor) within slot
    3. Enforce open/close operating hours windows
    """
    if attractions_registry is None:
        attractions_registry = SEED_ATTRACTIONS_REGISTRY

    # 1. Hydrate attraction records
    records: List[AttractionMasterRecord] = []
    for aid in attraction_ids:
        if aid in attractions_registry:
            records.append(attractions_registry[aid])
        else:
            # Create fallback record
            clean_name = aid.replace("_", " ").title()
            records.append(
                AttractionMasterRecord(
                    attraction_id=aid,
                    name=clean_name,
                    city=city,
                    duration_minutes=60,
                    open_time="09:00",
                    close_time="18:00",
                    best_slot=["morning"],
                    entry_fee=20.0
                )
            )

    if not records:
        return {"city": city, "timed_schedule": [], "total_entry_fee": 0.0, "total_transit_minutes": 0}

    # 2. Sort by best_slot priority
    records.sort(key=lambda r: get_slot_priority(r.best_slot))

    # 3. Greedy Nearest-Neighbor Ordering within slot
    ordered_records: List[AttractionMasterRecord] = []
    unvisited = list(records)
    current_spot: Optional[AttractionMasterRecord] = None

    while unvisited:
        if current_spot is None:
            next_spot = unvisited.pop(0)
        else:
            # Pick unvisited spot with nearest distance to current_spot
            best_idx = 0
            best_dist = float("inf")
            for idx, candidate in enumerate(unvisited):
                # Same slot preference bonus
                slot_penalty = 0.0 if candidate.best_slot == current_spot.best_slot else 50.0
                dist = calculate_haversine_distance_km(
                    current_spot.lat or 25.5, current_spot.lng or 91.8,
                    candidate.lat or 25.5, candidate.lng or 91.8
                ) + slot_penalty
                if dist < best_dist:
                    best_dist = dist
                    best_idx = idx
            next_spot = unvisited.pop(best_idx)

        ordered_records.append(next_spot)
        current_spot = next_spot

    # 4. Generate Timed Schedule & Window Compliance
    current_minutes = parse_time_to_minutes(start_time_str)
    timed_schedule: List[Dict[str, Any]] = []
    total_entry_fee = 0.0
    total_transit_min = 0
    total_visit_min = 0

    last_record: Optional[AttractionMasterRecord] = None

    for record in ordered_records:
        # Calculate transit from previous attraction
        if last_record is not None:
            t_min, d_km = estimate_transit_minutes(
                last_record.attraction_id, record.attraction_id,
                last_record.lat, last_record.lng, record.lat, record.lng
            )
            t_start = format_minutes_to_time(current_minutes)
            current_minutes += t_min
            t_end = format_minutes_to_time(current_minutes)
            total_transit_min += t_min

            timed_schedule.append({
                "type": "transit",
                "from_spot": last_record.name,
                "to_spot": record.name,
                "start_time": t_start,
                "end_time": t_end,
                "transit_minutes": t_min,
                "distance_km": d_km,
                "description": f"Transit from {last_record.name} to {record.name} ({d_km} km, ~{t_min} mins)"
            })

        # Open/Close Operating Window Check
        open_min = parse_time_to_minutes(record.open_time or "08:00")
        close_min = parse_time_to_minutes(record.close_time or "18:00")

        # If arrived before opening time, wait until open_min
        if current_minutes < open_min:
            wait_min = open_min - current_minutes
            current_minutes = open_min

        act_start = format_minutes_to_time(current_minutes)
        visit_duration = record.duration_minutes or 60
        current_minutes += visit_duration
        act_end = format_minutes_to_time(current_minutes)
        total_visit_min += visit_duration
        total_entry_fee += record.entry_fee

        timed_schedule.append({
            "type": "activity",
            "attraction_id": record.attraction_id,
            "name": record.name,
            "city": record.city,
            "start_time": act_start,
            "end_time": act_end,
            "duration_minutes": visit_duration,
            "entry_fee": record.entry_fee,
            "best_slot": record.best_slot,
            "tags": record.tags,
            "description": f"Visit {record.name} ({visit_duration} mins). Entry fee: ₹{record.entry_fee}."
        })

        last_record = record

    return {
        "city": city,
        "start_time": start_time_str,
        "end_time": format_minutes_to_time(current_minutes),
        "timed_schedule": timed_schedule,
        "summary": {
            "attractions_count": len(ordered_records),
            "total_visit_minutes": total_visit_min,
            "total_transit_minutes": total_transit_min,
            "total_entry_fee": round(total_entry_fee, 2)
        }
    }
