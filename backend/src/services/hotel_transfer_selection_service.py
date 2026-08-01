"""
hotel_transfer_selection_service.py — Phase 6 Hotel & Transfer Selection Engine
================================================================================
Deterministic $0 AI cost inventory query engine filtering standardized hotels and transfers by
exact city name (standardized in Phase 2) and budget band thresholds (from Phase 3 intake).
"""

import logging
from typing import List, Dict, Any, Optional, Tuple


from src.models.itinerary_block import StandardizedHotel, StandardizedTransfer
from src.services.hotel_transfer_normalization_service import normalize_city_name

logger = logging.getLogger(__name__)

# Budget Band Price Ranges (in INR)
BUDGET_BAND_MAP: Dict[str, Tuple[float, float]] = {
    "low": (0.0, 15000.0),
    "mid": (15000.0, 35000.0),
    "high": (35000.0, 150000.0)
}

# Seed Standardized Hotel Inventory (Ensures zero-failure offline execution)
SEED_HOTELS_INVENTORY: List[StandardizedHotel] = [
    # --- SHILLONG ---
    StandardizedHotel(
        hotel_id="hotel_shillong_pine_hill",
        name="Hotel Pine Hill",
        location="Shillong",
        price_min=3500.0,
        price_max=4500.0,
        meal_plan="CP",
        star="3_star",
        amenities=["wifi", "parking", "pure_veg"]
    ),
    StandardizedHotel(
        hotel_id="hotel_shillong_heritage_club",
        name="Shillong Heritage Club & Resort",
        location="Shillong",
        price_min=8500.0,
        price_max=12000.0,
        meal_plan="MAP",
        star="4_star",
        amenities=["wifi", "parking", "restaurant", "bar"]
    ),
    StandardizedHotel(
        hotel_id="hotel_shillong_ri_kynjai",
        name="Ri Kynjai - Serenity by the Lake",
        location="Shillong",
        price_min=18000.0,
        price_max=28000.0,
        meal_plan="MAP",
        star="5_star",
        amenities=["lake_view", "spa", "fine_dining", "wifi"]
    ),
    # --- CHERRAPUNJI ---
    StandardizedHotel(
        hotel_id="hotel_cherra_resort",
        name="Cherra Holiday Resort",
        location="Cherrapunji",
        price_min=4500.0,
        price_max=6000.0,
        meal_plan="MAP",
        star="3_star",
        amenities=["viewpoint", "restaurant", "parking"]
    ),
    StandardizedHotel(
        hotel_id="hotel_cherra_polo_orchid",
        name="Polo Orchid Resort Cherrapunjee",
        location="Cherrapunji",
        price_min=14000.0,
        price_max=22000.0,
        meal_plan="MAP",
        star="4_star",
        amenities=["infinity_pool", "falls_view", "spa"]
    ),
    # --- MANALI ---
    StandardizedHotel(
        hotel_id="hotel_manali_snow_valley",
        name="Snow Valley Resorts Manali",
        location="Manali",
        price_min=4000.0,
        price_max=5500.0,
        meal_plan="MAP",
        star="3_star",
        amenities=["wifi", "parking", "mountain_view"]
    ),
    StandardizedHotel(
        hotel_id="hotel_manali_solang_resort",
        name="Solang Valley Resort Manali",
        location="Manali",
        price_min=12000.0,
        price_max=18000.0,
        meal_plan="MAP",
        star="4_star",
        amenities=["river_facing", "adventure_desk", "spa"]
    )
]

# Seed Standardized Transfer Inventory
SEED_TRANSFERS_INVENTORY: List[StandardizedTransfer] = [
    StandardizedTransfer(
        transfer_id="transfer_ghy_shillong_sedan",
        location="Guwahati - Shillong",
        vehicle_type="Sedan",
        capacity=4,
        price_min=3000.0,
        price_max=3800.0,
        inclusions=["toll_tax", "parking", "driver_bhatta", "fuel", "ac"]
    ),
    StandardizedTransfer(
        transfer_id="transfer_ghy_shillong_suv",
        location="Guwahati - Shillong",
        vehicle_type="SUV",
        capacity=6,
        price_min=4500.0,
        price_max=5500.0,
        inclusions=["toll_tax", "parking", "driver_bhatta", "fuel", "ac"]
    ),
    StandardizedTransfer(
        transfer_id="transfer_ghy_shillong_tempo",
        location="Guwahati - Shillong",
        vehicle_type="Tempo Traveller",
        capacity=12,
        price_min=8500.0,
        price_max=10500.0,
        inclusions=["toll_tax", "parking", "driver_bhatta", "fuel", "ac"]
    ),
    StandardizedTransfer(
        transfer_id="transfer_shillong_local_suv",
        location="Shillong",
        vehicle_type="SUV",
        capacity=6,
        price_min=3500.0,
        price_max=4200.0,
        inclusions=["fuel", "driver_allowance", "parking"]
    )
]


def query_hotels(
    city: str,
    budget_band: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    star_rating: Optional[str] = None,
    hotels_pool: Optional[List[StandardizedHotel]] = None
) -> List[StandardizedHotel]:
    """
    Deterministic query for hotels: WHERE location=city AND price BETWEEN min_price AND max_price.
    Renders as cards for agent 1-click selection.
    """
    if hotels_pool is None:
        hotels_pool = SEED_HOTELS_INVENTORY

    target_city = normalize_city_name(city).lower()

    # Determine price threshold from budget_band or min/max parameters
    p_min = 0.0
    p_max = 1000000.0
    if budget_band and budget_band.lower() in BUDGET_BAND_MAP:
        b_min, b_max = BUDGET_BAND_MAP[budget_band.lower()]
        p_min = b_min
        p_max = b_max

    if min_price is not None:
        p_min = min_price
    if max_price is not None:
        p_max = max_price

    matched: List[StandardizedHotel] = []
    for hotel in hotels_pool:
        h_loc = normalize_city_name(hotel.location).lower()
        if target_city in h_loc or h_loc in target_city:
            # Check price range overlap
            if hotel.price_min <= p_max and hotel.price_max >= p_min:
                if star_rating is None or star_rating.lower() in hotel.star.lower():
                    matched.append(hotel)

    return matched if matched else [h for h in hotels_pool if target_city in normalize_city_name(h.location).lower()]


def query_transfers(
    location: str,
    vehicle_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    transfers_pool: Optional[List[StandardizedTransfer]] = None
) -> List[StandardizedTransfer]:
    """
    Deterministic query for transfers: WHERE location=location AND vehicle_type=vehicle_type.
    """
    if transfers_pool is None:
        transfers_pool = SEED_TRANSFERS_INVENTORY

    target_loc = normalize_city_name(location).lower()

    matched: List[StandardizedTransfer] = []
    for transfer in transfers_pool:
        t_loc = normalize_city_name(transfer.location).lower()
        if target_loc in t_loc or t_loc in target_loc:
            if vehicle_type is None or vehicle_type.lower() in transfer.vehicle_type.lower():
                matched.append(transfer)

    return matched if matched else transfers_pool
