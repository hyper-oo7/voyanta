"""
itinerary_block.py — Phase 0 Core Data Models for Voyanta ERP
=============================================================
Defines the foundational data structures replacing "PDF as unit of storage"
with composable Itinerary Blocks, Attraction Master Records, Standardized Hotels,
and Standardized Transfers.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class SlotMap(BaseModel):
    """Time-of-day allocation mapping for an itinerary block."""
    model_config = ConfigDict(populate_by_name=True)

    morning: List[str] = Field(default_factory=list, description="Morning attraction IDs")
    afternoon: List[str] = Field(default_factory=list, description="Afternoon attraction IDs")
    evening: List[str] = Field(default_factory=list, description="Evening attraction IDs")
    night: Optional[List[str]] = Field(default_factory=list, description="Night activity attraction IDs")


class ItineraryBlock(BaseModel):
    """
    Itinerary Block — The core unit of storage and composition in Voyanta.
    Replaces "PDF as unit of storage".
    """
    model_config = ConfigDict(populate_by_name=True)

    block_id: str = Field(..., description="Unique slug identifier (e.g. shillong_family_1day_003)")
    destination: str = Field(..., description="Primary destination city/spot (e.g. Shillong)")
    region: str = Field(..., description="Geographical region or state (e.g. Meghalaya)")
    duration_type: str = Field("1_day", description="Block duration (e.g. 1_day, half_day, 2_day)")
    theme_tags: List[str] = Field(default_factory=list, description="Theme tags (e.g. family, budget, honeymoon)")
    source_pdf: Optional[str] = Field(None, description="Original source PDF file name in vault")
    attractions_sequence: List[str] = Field(default_factory=list, description="Ordered attraction_id list")
    slot_map: Dict[str, List[str]] = Field(
        default_factory=lambda: {"morning": [], "afternoon": [], "evening": []},
        description="Time slot to attraction IDs map"
    )
    hotel_used_in_source: Optional[str] = Field(None, description="Baseline hotel mentioned in source document")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Extraction confidence score (0.0 to 1.0)")

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("confidence score must be between 0.0 and 1.0")
        return round(v, 4)


class AttractionMasterRecord(BaseModel):
    """
    Attraction Master Record — Knowledge graph node for points of interest & activities.
    """
    model_config = ConfigDict(populate_by_name=True)

    attraction_id: str = Field(..., description="Unique attraction slug (e.g. ward_lake)")
    name: str = Field(..., description="Verbatim attraction name (e.g. Ward's Lake)")
    city: str = Field(..., description="Parent destination city (e.g. Shillong)")
    duration_minutes: int = Field(60, ge=0, description="Recommended visit duration in minutes")
    open_time: Optional[str] = Field("08:00", description="Opening time HH:MM format")
    close_time: Optional[str] = Field("17:00", description="Closing time HH:MM format")
    best_slot: List[str] = Field(default_factory=lambda: ["morning"], description="Best slots: morning, afternoon, evening")
    entry_fee: float = Field(0.0, ge=0.0, description="Per person entry fee in local currency")
    lat: Optional[float] = Field(None, description="Latitude coordinate")
    lng: Optional[float] = Field(None, description="Longitude coordinate")
    tags: List[str] = Field(default_factory=list, description="Categorization tags: nature, family, budget")

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90.0 <= v <= 90.0):
            raise ValueError("Latitude must be between -90.0 and 90.0")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180.0 <= v <= 180.0):
            raise ValueError("Longitude must be between -180.0 and 180.0")
        return v


class StandardizedHotel(BaseModel):
    """
    Standardized Hotel entity for consistent B2B pricing & filter querying.
    """
    model_config = ConfigDict(populate_by_name=True)

    hotel_id: Optional[str] = Field(None, description="Unique hotel slug or UUID")
    name: str = Field(..., description="Hotel property name")
    location: str = Field(..., description="City or sub-destination area")
    price_min: float = Field(0.0, ge=0.0, description="Baseline minimum B2B rate per room night")
    price_max: float = Field(0.0, ge=0.0, description="Peak maximum B2B rate per room night")
    meal_plan: str = Field("CP", description="Meal plan: EP, CP, MAP, AP")
    star: str = Field("3_star", description="Star rating or category: 3_star, 4_star, 5_star, heritage, boutique")
    amenities: List[str] = Field(default_factory=list, description="Array of amenity tags: pool, wifi, pure_veg, spa")

    @model_validator(mode="after")
    def validate_price_range(self):
        if self.price_max < self.price_min:
            self.price_max = self.price_min
        return self


class StandardizedTransfer(BaseModel):
    """
    Standardized Transfer entity for transit routing & vehicle B2B pricing.
    """
    model_config = ConfigDict(populate_by_name=True)

    transfer_id: Optional[str] = Field(None, description="Unique transfer option slug")
    location: str = Field(..., description="Route segment or city location")
    vehicle_type: str = Field(..., description="Vehicle category e.g. Sedan, SUV, Tempo Traveller")
    capacity: int = Field(4, ge=1, description="Maximum passenger seating capacity")
    price_min: float = Field(0.0, ge=0.0, description="Minimum net vehicle/segment price")
    price_max: float = Field(0.0, ge=0.0, description="Maximum net vehicle/segment price")
    inclusions: List[str] = Field(
        default_factory=lambda: ["toll_tax", "parking", "driver_bhatta", "fuel"],
        description="Array of transfer inclusions"
    )

    @model_validator(mode="after")
    def validate_transfer_price_range(self):
        if self.price_max < self.price_min:
            self.price_max = self.price_min
        return self
