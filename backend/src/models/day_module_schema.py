"""
day_module_schema.py — Granular Day Modules, Hotel Rates & Distance Schemas
==========================================================================
Defines strict Pydantic schemas for Voyanta's Day Module vault, hotel rate cards,
distance feasibility matrix, and full-budget pricing rules.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict


class DayModuleActivity(BaseModel):
    """Activity or sightseeing item inside a day module."""
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., description="Activity title verbatim")
    duration: Optional[str] = Field(None, description="e.g. 2 hours, Half day")
    timing: Optional[str] = Field(None, description="e.g. 09:00 AM")
    location: Optional[str] = Field(None, description="Sub-destination or spot")
    description: Optional[str] = Field(None, description="Detailed activity narrative")
    image_url: Optional[str] = Field("", description="Activity preview image")
    cost_estimate: Optional[float] = Field(0.0, description="Baseline cost per person")


class DayModuleHotel(BaseModel):
    """Hotel option associated with a day module."""
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., description="Hotel name")
    category: Optional[str] = Field(None, description="Star rating or tier e.g. 4 Star, Heritage")
    location: Optional[str] = Field(None, description="City / area")
    meal_plan: Optional[str] = Field("CP", description="Meal plan: CP, MAP, AP, EP")
    price_per_night: Optional[float] = Field(0.0, description="B2B Net price per room night")
    image_url: Optional[str] = Field("", description="Hotel preview photo")


class DayModule(BaseModel):
    """
    Granular, composable Day Module block.
    Unit of reusability in Voyanta 1-Shot Engine.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique module identifier")
    agency_id: Optional[str] = Field("global", description="Agency ID owning this module")
    destination: str = Field(..., description="Primary destination (e.g. Himachal, Kerala)")
    sub_destination: str = Field(..., description="City or valley (e.g. Manali, Solang Valley)")
    day_number_hint: Optional[int] = Field(1, description="Typical sequence day (1, 2, 3...)")
    title: str = Field(..., description="Day title e.g. Solang Valley Adventure & Café Hopping")
    description: str = Field("", description="Full day narrative description")
    pace_tag: Literal["slow", "medium", "fast"] = Field("medium", description="Pace calibration")
    group_tags: List[str] = Field(default_factory=lambda: ["friends", "couples", "family"], description="Fit: friends, couples, family, solo, elderly")
    season_tags: List[str] = Field(default_factory=lambda: ["summer", "winter", "monsoon"], description="Fit seasons")
    preference_tags: List[str] = Field(default_factory=list, description="Tags: beach, lakes, no_trekking, veg_only, heritage")
    negative_tags: List[str] = Field(default_factory=list, description="Excluded tags: trekking, steep_climb")
    activities: List[DayModuleActivity] = Field(default_factory=list)
    hotels: List[DayModuleHotel] = Field(default_factory=list)
    estimated_transit_hours: float = Field(0.0, description="Transit hours within the day")
    estimated_cost: float = Field(0.0, description="Baseline cost estimate per person")


class HotelRateEntry(BaseModel):
    """Extracted or stored B2B hotel rate sheet entry."""
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    agency_id: str = Field("global", description="Agency ID")
    hotel_name: str = Field(..., description="Hotel name verbatim")
    category: Optional[str] = Field("Deluxe", description="Star rating / category")
    location: str = Field(..., description="City / Sub-destination")
    room_type: Optional[str] = Field("Standard", description="Deluxe, Suite, Super Deluxe")
    meal_plan: Literal["EP", "CP", "MAP", "AP"] = Field("CP", description="Meal inclusion plan")
    net_rate: float = Field(..., description="B2B Net negotiated price per night")
    currency: str = Field("INR", description="Currency code")
    is_active: bool = Field(True, description="Active rate flag")


class MarginConfig(BaseModel):
    """Full-budget agency margin configuration."""
    model_config = ConfigDict(populate_by_name=True)

    margin_type: Literal["percentage", "flat"] = Field("percentage", description="Percentage or flat amount")
    margin_value: float = Field(15.0, description="e.g. 15.0 for 15%, or 5000.0 for ₹5000 flat margin")
    tax_rate_percent: float = Field(5.0, description="GST / Tax percentage e.g. 5.0%")
    discount_amount: float = Field(0.0, description="Discount amount subtracted from total")
    visibility_mode: Literal["ITEMIZED", "TOTAL_ONLY"] = Field("ITEMIZED", description="Itemized breakdown vs single lump-sum package price")


class CostingBreakdown(BaseModel):
    """Final calculated full-budget proposal costing."""
    model_config = ConfigDict(populate_by_name=True)

    net_subtotal: float = Field(..., description="Raw net sum of hotels, transfers, activities")
    margin_type: str = Field("percentage", description="Margin mode used")
    margin_value: float = Field(0.0, description="Configured margin value")
    margin_amount: float = Field(..., description="Calculated margin in currency")
    gross_amount: float = Field(..., description="Subtotal + Margin")
    tax_amount: float = Field(..., description="Calculated tax/GST")
    discount_amount: float = Field(0.0, description="Discount subtracted")
    final_package_total: float = Field(..., description="Final payable package total")
    price_per_person: float = Field(..., description="Final total divided by total travelers")
    currency: str = Field("INR", description="Currency code")
    visibility_mode: str = Field("ITEMIZED", description="ITEMIZED or TOTAL_ONLY")


class DistanceMatrixEntry(BaseModel):
    """Cached geographic distance entry between sub-destinations."""
    model_config = ConfigDict(populate_by_name=True)

    origin: str = Field(..., description="Origin city / area (lowercase)")
    destination: str = Field(..., description="Destination city / area (lowercase)")
    distance_km: float = Field(..., description="Distance in kilometers")
    travel_time_hours: float = Field(..., description="Estimated travel time in hours")
    is_feasible_same_day: bool = Field(True, description="Feasible to visit both on the same day")
