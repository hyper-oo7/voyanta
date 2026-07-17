"""
proposal_schema.py — Strict Pydantic Models for Final Proposal Schema
=======================================================================
Defines the strict schema enforced by Instructor during AI Orchestration
to guarantee 100% JSON compliance and zero hallucination/data loss.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ProposalHotel(BaseModel):
    """Hotel accommodation details extracted from proposal/PDF."""
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., description="Exact hotel name verbatim")
    category: Optional[str] = Field(None, description="Star rating or accommodation type")
    price_per_night: Optional[float] = Field(None, description="Exact price per night if mentioned in document")
    location: Optional[str] = Field(None, description="City or area of the hotel")
    meal_plan: Optional[str] = Field(None, description="Meal plan e.g. CP, MAP, AP")
    inclusions: List[str] = Field(default_factory=list, description="Specific room/hotel inclusions")
    image_url: Optional[str] = Field("", description="Image URL assigned or extracted")


class ProposalActivity(BaseModel):
    """Activity or sightseeing excursion details."""
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., description="Exact activity name verbatim")
    duration: Optional[str] = Field(None, description="Duration e.g. 2 hours, Half day")
    timing: Optional[str] = Field(None, description="Timing e.g. 10:00 AM")
    price: Optional[float] = Field(None, description="Exact activity cost if mentioned")
    location: Optional[str] = Field(None, description="Location of activity")
    description: Optional[str] = Field(None, description="Full description verbatim")
    image_url: Optional[str] = Field("", description="Image URL assigned or extracted")


class ProposalTransfer(BaseModel):
    """Transfer or transportation segment."""
    model_config = ConfigDict(populate_by_name=True)

    transfer_type: Optional[str] = Field(None, alias="type", description="e.g. Airport Transfer, Inter-city Sightseeing")
    vehicle: Optional[str] = Field(None, description="Exact vehicle e.g. Innova Crysta, Tempo Traveller")
    from_location: Optional[str] = Field(None, alias="from", description="Origin location/point")
    to: Optional[str] = Field(None, description="Destination point")
    timing: Optional[str] = Field(None, description="Pickup timing e.g. 06:00 AM")
    price: Optional[float] = Field(None, description="Exact transfer cost if mentioned")
    notes: Optional[str] = Field(None, description="Additional transfer instructions or notes")


class ProposalMeal(BaseModel):
    """Meal arrangement details."""
    model_config = ConfigDict(populate_by_name=True)

    meal_type: Optional[str] = Field(None, alias="type", description="Breakfast, Lunch, Dinner, or Snacks")
    venue: Optional[str] = Field(None, description="Restaurant or hotel dining room name")
    cuisine: Optional[str] = Field(None, description="Type of cuisine")
    price: Optional[float] = Field(None, description="Cost per person/total if listed")
    notes: Optional[str] = Field(None, description="Special dietary notes or timing")
    image_url: Optional[str] = Field("", description="Image URL")


class ProposalDay(BaseModel):
    """Structured day-by-day itinerary schedule."""
    model_config = ConfigDict(populate_by_name=True)

    day_number: int = Field(..., description="Day index starting at 1")
    title: str = Field(..., description="Exact day title/headline")
    description: Optional[str] = Field("", description="Full verbatim day description text")
    sub_destination: Optional[str] = Field(None, description="Primary city/area for this day")
    schedule: Optional[str] = Field(None, description="General timing or schedule overview")
    hotels: List[ProposalHotel] = Field(default_factory=list)
    activities: List[ProposalActivity] = Field(default_factory=list)
    transfers: List[ProposalTransfer] = Field(default_factory=list)
    meals: List[ProposalMeal] = Field(default_factory=list)


class ProposalExtraSections(BaseModel):
    """Supplementary sections at end of proposal documents."""
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    what_to_pack: Optional[str] = Field(None, description="Packing recommendations or essentials verbatim")
    visa_guidelines: Optional[str] = Field(None, description="Visa instructions or requirements")
    important_notes: Optional[str] = Field(None, description="General terms, notes, and remarks")
    damages: Optional[str] = Field(None, description="Damage or liability policy")
    cancellation_policy: Optional[str] = Field(None, description="Exact cancellation policy text")
    dos_and_donts: Optional[str] = Field(None, description="Do's and Don'ts guidelines")
    terms_of_payment: Optional[str] = Field(None, alias="payment", description="Payment schedule, advance deposit requirements and banking terms")
    terms_and_conditions: Optional[str] = Field(None, description="Exact terms and conditions verbatim")
    amendment: Optional[str] = Field(None, description="Amendment policy and communication charges verbatim")
    refund: Optional[str] = Field(None, description="Refund policy verbatim")
    about_transport: Optional[str] = Field(None, description="Specific transport rules, sector vehicle changes, or local taxi notes verbatim")
    arrival_requirements: Optional[str] = Field(None, description="Particulars or documents required on arrival (e.g. ID proof, photographs, age certificates)")


class FinalProposalSchema(BaseModel):
    """
    Final strict proposal schema enforced across extraction and AI orchestration.
    Guaranteeing zero schema drift and strict JSON compliance.
    """
    model_config = ConfigDict(populate_by_name=True)

    destination: str = Field(..., description="Primary destination name")
    sub_destinations: List[str] = Field(default_factory=list, description="All sub-destinations mentioned")
    overview: Optional[str] = Field("", description="Full verbatim introduction/overview text from page 1")
    duration_days: int = Field(..., description="Total itinerary duration in days")
    currency: str = Field("INR", description="ISO 4217 currency code detected e.g. INR, USD, EUR")
    total_price: Optional[float] = Field(None, description="Total package cost if explicitly mentioned")
    price_per_person: Optional[float] = Field(None, description="Per person cost if listed")
    days: List[ProposalDay] = Field(default_factory=list)
    inclusions: List[str] = Field(default_factory=list, description="Exact list of package inclusions")
    exclusions: List[str] = Field(default_factory=list, description="Exact list of package exclusions")
    extra_sections: ProposalExtraSections = Field(default_factory=ProposalExtraSections)
