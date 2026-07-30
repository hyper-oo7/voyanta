"""
hotel_rate_parser.py — Deterministic B2B Hotel Rate Sheet Parser
================================================================
Extracts structured hotel rate cards from agency CSV or PDF uploads.
Parses Hotel Name, Location, Category, Room Type, Meal Plan (CP/MAP/AP/EP),
and negotiated Net B2B Rates without high AI LLM cost.
"""

import csv
import io
import re
import logging
from typing import List, Dict, Any, Optional
from src.models.day_module_schema import HotelRateEntry

logger = logging.getLogger(__name__)


def parse_hotel_rates_csv(csv_content: str, agency_id: str = "global") -> List[HotelRateEntry]:
    """
    Parses a CSV rate sheet into structured HotelRateEntry items.
    Expected CSV columns (flexible headers):
    Hotel Name / Name, Location / City, Category / Star, Room Type, Meal Plan, Net Rate / Price
    """
    results: List[HotelRateEntry] = []
    if not csv_content or not csv_content.strip():
        return results

    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for idx, row in enumerate(reader):
            # Clean keys to lowercase with underscores
            clean_row = {str(k).strip().lower().replace(" ", "_"): str(v).strip() for k, v in row.items() if k}
            
            # Key mappings
            hotel_name = (
                clean_row.get("hotel_name") or clean_row.get("hotel") or
                clean_row.get("name") or clean_row.get("property")
            )
            if not hotel_name:
                continue

            location = clean_row.get("location") or clean_row.get("city") or clean_row.get("destination") or clean_row.get("area") or "General"
            category = clean_row.get("category") or clean_row.get("star") or clean_row.get("tier") or "Deluxe"
            room_type = clean_row.get("room_type") or clean_row.get("room") or clean_row.get("type") or "Standard"
            
            # Meal Plan normalization
            raw_meal = (clean_row.get("meal_plan") or clean_row.get("meal") or clean_row.get("plan") or "CP").upper()
            meal_plan = "CP"
            if "MAP" in raw_meal or "HALF" in raw_meal:
                meal_plan = "MAP"
            elif "AP" in raw_meal or "FULL" in raw_meal:
                meal_plan = "AP"
            elif "EP" in raw_meal or "ROOM ONLY" in raw_meal:
                meal_plan = "EP"

            # Parse net rate number
            raw_rate = clean_row.get("net_rate") or clean_row.get("rate") or clean_row.get("price") or clean_row.get("net_price") or "0"
            clean_num = re.sub(r"[^\d.]", "", raw_rate)
            try:
                net_rate = float(clean_num) if clean_num else 0.0
            except ValueError:
                net_rate = 0.0

            entry = HotelRateEntry(
                id=f"rate_{agency_id}_{idx+1}",
                agency_id=agency_id,
                hotel_name=hotel_name,
                category=category,
                location=location,
                room_type=room_type,
                meal_plan=meal_plan,
                net_rate=net_rate,
                currency="INR"
            )
            results.append(entry)

    except Exception as e:
        logger.error(f"[HotelRateParser] Failed to parse CSV: {e}")

    return results


def parse_hotel_rates_text(text_content: str, agency_id: str = "global") -> List[HotelRateEntry]:
    """
    Parses unstructured text extracted from a PDF rate card using deterministic regex patterns.
    Extracts hotel names, location names, meal plans, and prices.
    """
    results: List[HotelRateEntry] = []
    if not text_content:
        return results

    lines = text_content.splitlines()
    current_location = "General"

    for idx, line in enumerate(lines):
        line_clean = line.strip()
        if not line_clean:
            continue

        # Location header detector (e.g. "SHILLONG HOTELS", "MANALI PACKAGES")
        if any(keyword in line_clean.upper() for keyword in ["HOTELS IN", "LOCATION:", "DESTINATION:", "REGION:"]):
            loc_match = re.sub(r"(?i)(HOTELS IN|LOCATION:|DESTINATION:|REGION:)", "", line_clean).strip()
            if loc_match:
                current_location = loc_match
            continue

        # Regex for matching hotel name + meal plan + price (e.g. "Hotel Snow Crest - MAP Plan @ Rs 3500")
        price_match = re.search(r"₹?\s*(\d{3,6})\b", line_clean)
        if price_match:
            price = float(price_match.group(1))
            # Extract name before price/meal plan
            name_part = line_clean[:price_match.start()].strip()
            name_part = re.sub(r"[-–@:]+", " ", name_part).strip()

            if len(name_part) > 3:
                # Detect meal plan
                raw_upper = line_clean.upper()
                meal_plan = "CP"
                if "MAP" in raw_upper:
                    meal_plan = "MAP"
                elif "AP" in raw_upper:
                    meal_plan = "AP"
                elif "EP" in raw_upper or "ROOM ONLY" in raw_upper:
                    meal_plan = "EP"

                entry = HotelRateEntry(
                    id=f"rate_pdf_{agency_id}_{idx+1}",
                    agency_id=agency_id,
                    hotel_name=name_part if len(name_part) < 50 else name_part[:50],
                    category="Deluxe",
                    location=current_location,
                    room_type="Standard",
                    meal_plan=meal_plan,
                    net_rate=price,
                    currency="INR"
                )
                results.append(entry)

    return results
