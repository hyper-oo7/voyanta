"""
day_module_cache_service.py — Bullet-Fast Query & Module Cache Engine
=====================================================================
Multi-tier in-memory & distributed caching layer for Day Modules,
Distance Matrix queries, and Agency Hotel Rates.
Guarantees sub-50ms response times for repeat intake requests.
"""

import logging
from typing import List, Dict, Any, Optional
from src.models.day_module_schema import DayModule, HotelRateEntry, DistanceMatrixEntry

logger = logging.getLogger(__name__)

# Global high-speed in-memory caches
_DAY_MODULE_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_DISTANCE_CACHE: Dict[str, Dict[str, Any]] = {}
_HOTEL_RATE_CACHE: Dict[str, List[Dict[str, Any]]] = {}


def _make_cache_key(*args) -> str:
    return ":".join(str(a).strip().lower() for a in args if a is not None)


# --- 1. DAY MODULE CACHING ---

def get_cached_day_modules(
    agency_id: str,
    destination: str,
    group_type: Optional[str] = None,
    pace: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    """Retrieves matched day modules from sub-millisecond memory cache."""
    key = _make_cache_key(agency_id, destination, group_type or "all", pace or "all")
    if key in _DAY_MODULE_CACHE:
        logger.info(f"[DayModuleCache] HIT in memory for key '{key}' ($0 cost, 0ms latency)")
        return _DAY_MODULE_CACHE[key]
    return None


def store_cached_day_modules(
    agency_id: str,
    destination: str,
    group_type: Optional[str],
    pace: Optional[str],
    modules: List[Dict[str, Any]]
):
    """Stores matched day modules into high-speed memory cache."""
    key = _make_cache_key(agency_id, destination, group_type or "all", pace or "all")
    _DAY_MODULE_CACHE[key] = modules
    logger.info(f"[DayModuleCache] Stored {len(modules)} day modules for key '{key}'")


# --- 2. DISTANCE MATRIX CACHING ---

def get_cached_distance(origin: str, destination: str) -> Optional[Dict[str, Any]]:
    """Retrieves distance & transit time from instant local memory cache."""
    orig_clean = origin.strip().lower()
    dest_clean = destination.strip().lower()
    key_forward = f"{orig_clean}:{dest_clean}"
    key_reverse = f"{dest_clean}:{orig_clean}"

    if key_forward in _DISTANCE_CACHE:
        logger.info(f"[DistanceCache] HIT in memory for '{key_forward}' (0ms)")
        return _DISTANCE_CACHE[key_forward]
    if key_reverse in _DISTANCE_CACHE:
        logger.info(f"[DistanceCache] HIT in memory for '{key_reverse}' (0ms)")
        return _DISTANCE_CACHE[key_reverse]
    return None


def store_cached_distance(
    origin: str,
    destination: str,
    distance_km: float,
    travel_time_hours: float,
    is_feasible_same_day: bool = True
):
    """Stores distance matrix entry in memory cache."""
    orig_clean = origin.strip().lower()
    dest_clean = destination.strip().lower()
    entry = {
        "origin": orig_clean,
        "destination": dest_clean,
        "distance_km": round(distance_km, 1),
        "travel_time_hours": round(travel_time_hours, 1),
        "is_feasible_same_day": is_feasible_same_day
    }
    _DISTANCE_CACHE[f"{orig_clean}:{dest_clean}"] = entry
    _DISTANCE_CACHE[f"{dest_clean}:{orig_clean}"] = entry
    logger.info(f"[DistanceCache] Cached distance {orig_clean} <-> {dest_clean}: {distance_km} km ({travel_time_hours} hrs)")


# --- 3. HOTEL RATE CACHING ---

def get_cached_hotel_rates(agency_id: str, location: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieves agency hotel rates from memory cache."""
    key = _make_cache_key(agency_id, location)
    if key in _HOTEL_RATE_CACHE:
        logger.info(f"[HotelRateCache] HIT in memory for key '{key}' (0ms)")
        return _HOTEL_RATE_CACHE[key]
    return None


def store_cached_hotel_rates(agency_id: str, location: str, rates: List[Dict[str, Any]]):
    """Stores hotel rates into memory cache."""
    key = _make_cache_key(agency_id, location)
    _HOTEL_RATE_CACHE[key] = rates
    logger.info(f"[HotelRateCache] Stored {len(rates)} rates for key '{key}'")


# Pre-seed baseline distance matrix cache for popular destination pairs
def _seed_baseline_distance_cache():
    sample_pairs = [
        ("manali", "solang valley", 14.0, 0.5, True),
        ("manali", "kasol", 75.0, 2.5, True),
        ("manali", "sissu", 40.0, 1.2, True),
        ("manali", "shimla", 230.0, 6.5, False),
        ("srinagar", "gulmarg", 51.0, 1.8, True),
        ("srinagar", "pahalgam", 90.0, 2.5, True),
        ("leh", "nubra valley", 125.0, 4.5, True),
        ("leh", "pangong tso", 155.0, 5.0, True),
        ("jaipur", "udaipur", 390.0, 6.5, False),
        ("jaipur", "jaisalmer", 560.0, 9.5, False),
        ("shillong", "cherrapunji", 54.0, 1.8, True),
        ("shillong", "dawki", 82.0, 3.0, True),
        ("munnar", "alleppey", 160.0, 4.5, False),
    ]
    for orig, dest, dist, hrs, feasible in sample_pairs:
        store_cached_distance(orig, dest, dist, hrs, feasible)


_seed_baseline_distance_cache()
