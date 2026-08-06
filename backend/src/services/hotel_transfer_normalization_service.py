"""
hotel_transfer_normalization_service.py — Phase 2 Hotel & Transfer Normalization Engine
========================================================================================
Standardizes city and route location names across hotels and transfer rate sheets to match
attraction city names exactly (e.g. "Shillong" not "shillong" or "Shillong, Meghalaya").
Ensures Phase 6 exact-match query joins work deterministically without fuzzy mismatches.
"""

import csv
import io
import re
import logging
from typing import List, Dict, Any, Optional, Tuple

from src.models.itinerary_block import StandardizedHotel, StandardizedTransfer

logger = logging.getLogger(__name__)

# Known City Aliases & Airport Code Mapping
CITY_ALIAS_MAP: Dict[str, str] = {
    "ghy": "Guwahati",
    "guwahati airport": "Guwahati",
    "gauhati": "Guwahati",
    "ixb": "Bagdogra",
    "bagdogra airport": "Bagdogra",
    "sxr": "Srinagar",
    "srinagar airport": "Srinagar",
    "cok": "Kochi",
    "cochin": "Kochi",
    "kochi/cochin": "Kochi",
    "bom": "Mumbai",
    "bombay": "Mumbai",
    "del": "Delhi",
    "new delhi": "Delhi",
    "cal": "Kolkata",
    "calcutta": "Kolkata",
    "jai": "Jaipur",
    "ixl": "Leh",
    "ladakh/leh": "Leh",
    "maa": "Chennai",
    "madras": "Chennai",
    "blr": "Bengaluru",
    "bangalore": "Bengaluru",
    "mly": "Mawlynnong",
    "cherra": "Cherrapunji",
    "sohra": "Cherrapunji",
}

# Known Regions & States to strip when normalizing city names
KNOWN_REGIONS_TO_STRIP: List[str] = [
    "meghalaya", "himachal pradesh", "himachal", "rajasthan", "kerala",
    "jammu and kashmir", "kashmir", "ladakh", "uttarakhand", "goa", "karnataka",
    "tamil nadu", "west bengal", "assam", "sikkim", "india"
]


def normalize_city_name(raw_location: str) -> str:
    """
    Standardizes raw location/city text to match canonical attraction city names.
    E.g.
    - "shillong" -> "Shillong"
    - "Shillong, Meghalaya" -> "Shillong"
    - "Manali (Himachal Pradesh)" -> "Manali"
    - "Guwahati Airport" -> "Guwahati"
    - "Guwahati to Shillong" -> "Guwahati - Shillong"
    """
    if not raw_location or not raw_location.strip():
        return "General"

    text = raw_location.strip()

    # Route format handling e.g. "Guwahati to Shillong" or "Guwahati -> Shillong"
    route_match = re.split(r"\s+(?:to|->|=>)\s+", text, flags=re.IGNORECASE)
    if len(route_match) == 2:
        start_city = normalize_single_city(route_match[0])
        end_city = normalize_single_city(route_match[1])
        return f"{start_city} - {end_city}"

    return normalize_single_city(text)



def normalize_single_city(text: str) -> str:
    """Helper to normalize a single city string."""
    clean = text.strip()

    # Remove parenthetical info e.g. "Shillong (East Khasi Hills)" -> "Shillong"
    clean = re.sub(r"\(.*?\)", "", clean).strip()

    # Split by comma e.g. "Shillong, Meghalaya, India" -> ["Shillong", "Meghalaya", "India"]
    parts = [p.strip() for p in clean.split(",") if p.strip()]

    primary_part = parts[0] if parts else clean

    # Check for dash suffix e.g. "Shillong - Meghalaya" -> "Shillong"
    dash_parts = [p.strip() for p in primary_part.split("-") if p.strip()]
    if len(dash_parts) > 1 and dash_parts[1].lower() in KNOWN_REGIONS_TO_STRIP:
        primary_part = dash_parts[0]

    # Lowercase check against Alias Map
    key_lower = primary_part.lower()
    if key_lower in CITY_ALIAS_MAP:
        return CITY_ALIAS_MAP[key_lower]

    # Title Case cleanup
    words = primary_part.split()
    capitalized_words = [w.capitalize() for w in words]
    res = " ".join(capitalized_words)

    return res or "General"


def normalize_hotel_entry(raw_data: Dict[str, Any], agency_id: str = "global") -> StandardizedHotel:
    """
    Normalizes raw hotel data or CSV row into a StandardizedHotel model.
    """
    # Keys cleanup
    clean_dict = {str(k).strip().lower().replace(" ", "_"): v for k, v in raw_data.items() if k}

    name = str(clean_dict.get("hotel_name") or clean_dict.get("name") or clean_dict.get("property") or "Standard Hotel").strip()
    raw_loc = str(clean_dict.get("location") or clean_dict.get("city") or clean_dict.get("area") or "General")
    location = normalize_city_name(raw_loc)

    # Rates
    raw_min = str(clean_dict.get("price_min") or clean_dict.get("net_rate") or clean_dict.get("rate") or clean_dict.get("price") or "0")
    raw_max = str(clean_dict.get("price_max") or clean_dict.get("peak_rate") or raw_min)

    num_min = float(re.sub(r"[^\d.]", "", raw_min) or 0.0)
    num_max = float(re.sub(r"[^\d.]", "", raw_max) or num_min)

    # Meal Plan
    meal_raw = str(clean_dict.get("meal_plan") or clean_dict.get("meal") or "CP").upper()
    meal_plan = "CP"
    if "MAP" in meal_raw or "HALF" in meal_raw:
        meal_plan = "MAP"
    elif "AP" in meal_raw or "FULL" in meal_raw:
        meal_plan = "AP"
    elif "EP" in meal_raw or "ROOM" in meal_raw:
        meal_plan = "EP"

    # Star rating
    star_raw = str(clean_dict.get("star") or clean_dict.get("category") or clean_dict.get("tier") or "3_star").lower()
    star = "3_star"
    if "5" in star_raw or "luxury" in star_raw:
        star = "5_star"
    elif "4" in star_raw or "premium" in star_raw:
        star = "4_star"
    elif "heritage" in star_raw:
        star = "heritage"
    elif "boutique" in star_raw:
        star = "boutique"

    # Amenities
    amenities_raw = clean_dict.get("amenities") or clean_dict.get("features") or []
    if isinstance(amenities_raw, str):
        amenities_list = [a.strip().lower() for a in amenities_raw.split(",") if a.strip()]
    elif isinstance(amenities_raw, list):
        amenities_list = [str(a).strip().lower() for a in amenities_raw if a]
    else:
        amenities_list = []

    hotel_slug = re.sub(r"^\w", "", name)[:12]

    return StandardizedHotel(
        hotel_id=f"hotel_{agency_id}_{hotel_slug}",
        name=name,
        location=location,
        price_min=num_min,
        price_max=max(num_min, num_max),
        meal_plan=meal_plan,
        star=star,
        amenities=amenities_list
    )


def normalize_transfer_entry(raw_data: Dict[str, Any], agency_id: str = "global") -> StandardizedTransfer:
    """
    Normalizes raw transfer data or CSV row into a StandardizedTransfer model.
    """
    clean_dict = {str(k).strip().lower().replace(" ", "_"): v for k, v in raw_data.items() if k}

    raw_loc = str(clean_dict.get("location") or clean_dict.get("route") or clean_dict.get("city") or "General")
    location = normalize_city_name(raw_loc)

    veh_raw = str(clean_dict.get("vehicle_type") or clean_dict.get("vehicle") or clean_dict.get("car") or "Sedan").strip()
    veh_lower = veh_raw.lower()
    vehicle_type = "Sedan"
    capacity = 4

    if "suv" in veh_lower or "innovas" in veh_lower or "ertiga" in veh_lower:
        vehicle_type = "SUV"
        capacity = 6
    elif "tempo" in veh_lower or "traveller" in veh_lower or "van" in veh_lower:
        vehicle_type = "Tempo Traveller"
        capacity = 12
    elif "bus" in veh_lower or "coach" in veh_lower:
        vehicle_type = "Luxury Bus"
        capacity = 24

    # Prices
    raw_min = str(clean_dict.get("price_min") or clean_dict.get("rate") or clean_dict.get("price") or "0")
    raw_max = str(clean_dict.get("price_max") or clean_dict.get("peak_rate") or raw_min)

    num_min = float(re.sub(r"[^\d.]", "", raw_min) or 0.0)
    num_max = float(re.sub(r"[^\d.]", "", raw_max) or num_min)

    # Inclusions
    inc_raw = clean_dict.get("inclusions") or []
    if isinstance(inc_raw, str):
        inc_list = [i.strip().lower() for i in inc_raw.split(",") if i.strip()]
    elif isinstance(inc_raw, list):
        inc_list = [str(i).strip().lower() for i in inc_raw if i]
    else:
        inc_list = ["toll_tax", "parking", "driver_bhatta", "fuel"]

    vehicle_slug = vehicle_type.lower().replace(" ", "_")
    location_slug = re.sub(r"[^\w]", "", location)[:10]

    return StandardizedTransfer(
        transfer_id=f"transfer_{agency_id}_{vehicle_slug}_{location_slug}",
        location=location,
        vehicle_type=vehicle_type,
        capacity=capacity,
        price_min=num_min,
        price_max=max(num_min, num_max),
        inclusions=inc_list
    )


def parse_and_normalize_hotels_csv(csv_content: str, agency_id: str = "global") -> List[StandardizedHotel]:
    """
    Parses hotel rate sheet CSV and applies city name standardization.
    """
    results: List[StandardizedHotel] = []
    if not csv_content or not csv_content.strip():
        return results

    try:
        reader = csv.DictReader(io.StringIO(csv_content.strip()))
        for row in reader:
            if not any(str(v).strip() for v in row.values() if v is not None):
                continue
            hotel = normalize_hotel_entry(row, agency_id=agency_id)
            results.append(hotel)
    except Exception as e:
        logger.error(f"[Phase 2 Normalization] Failed to parse hotels CSV: {e}")

    return results


def parse_and_normalize_transfers_csv(csv_content: str, agency_id: str = "global") -> List[StandardizedTransfer]:
    """
    Parses transfer rate sheet CSV and applies city/route location standardization.
    """
    results: List[StandardizedTransfer] = []
    if not csv_content or not csv_content.strip():
        return results

    try:
        reader = csv.DictReader(io.StringIO(csv_content.strip()))
        for row in reader:
            if not any(str(v).strip() for v in row.values() if v is not None):
                continue
            transfer = normalize_transfer_entry(row, agency_id=agency_id)
            results.append(transfer)
    except Exception as e:
        logger.error(f"[Phase 2 Normalization] Failed to parse transfers CSV: {e}")

    return results



def bulk_normalize_hotel_records(records: List[Dict[str, Any]]) -> List[StandardizedHotel]:
    """Runs a bulk normalization pass over an array of raw hotel records."""
    return [normalize_hotel_entry(r) for r in records]


def bulk_normalize_transfer_records(records: List[Dict[str, Any]]) -> List[StandardizedTransfer]:
    """Runs a bulk normalization pass over an array of raw transfer records."""
    return [normalize_transfer_entry(r) for r in records]
