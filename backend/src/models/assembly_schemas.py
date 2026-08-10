from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ── Vault Items (mirrors Supabase schema) ─────────────────────

class VaultHotel(BaseModel):
    id: str
    name: str
    location: Optional[str] = None
    country: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    price_per_night: Optional[float] = 0
    meal_type: Optional[str] = "CP"
    room_type: Optional[str] = None
    amenities: Optional[str] = None
    currency: Optional[str] = "INR"
    image_url: Optional[str] = None


class VaultActivity(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    location: Optional[str] = None
    duration_hours: Optional[float] = None
    price: Optional[float] = 0
    currency: Optional[str] = "INR"
    description: Optional[str] = None
    image_url: Optional[str] = None


class VaultFlight(BaseModel):
    id: str
    airline: str
    class_: Optional[str] = Field(default="Economy", alias="class")
    origin: Optional[str] = None
    destination: Optional[str] = None
    depart_date: Optional[str] = None
    flight_no: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[float] = 0
    currency: Optional[str] = "INR"


class VaultTemplate(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    days: Optional[int] = None
    destination: Optional[str] = None
    price_from: Optional[float] = None
    currency: Optional[str] = "INR"
    image_url: Optional[str] = None


# ── RAG Context ────────────────────────────────────────────────────

class RAGChunk(BaseModel):
    text: str
    source: Optional[str] = None
    score: Optional[float] = None


class RAGContext(BaseModel):
    chunks: List[RAGChunk] = []
    assembled_query: Optional[str] = ""


# ── Vault Matches ──────────────────────────────────────────────────

class VaultMatches(BaseModel):
    hotels: List[VaultHotel] = []
    activities: List[VaultActivity] = []
    flights: List[VaultFlight] = []
    templates: List[VaultTemplate] = []


# ── Costing Preferences ────────────────────────────────────────────

class CostingPrefs(BaseModel):
    fixed_markup: float = 0
    pct_markup: float = 15
    discount: float = 0
    tax: float = 5
    margin_type: str = "percentage"
    margin_value: float = 15
    visibility_mode: str = "ITEMIZED"


# ── Request / Response ─────────────────────────────────────────────

class AssembleRequest(BaseModel):
    client_name: str = "Valued Traveler"
    destination: str
    duration_days: int = 5
    num_travelers: int = 2
    budget_per_head: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    pace: Optional[str] = "medium"
    special_notes: Optional[str] = ""
    arrival_city: Optional[str] = ""
    departure_city: Optional[str] = ""
    arrival_airport: Optional[str] = ""
    departure_airport: Optional[str] = ""
    agency_id: Optional[str] = "demo-agency"
    rag_context: RAGContext = Field(default_factory=RAGContext)
    vault_matches: VaultMatches = Field(default_factory=VaultMatches)
    costing_prefs: CostingPrefs = Field(default_factory=CostingPrefs)
    
    # Advanced / Intake fields
    group_type: str = "friends"
    num_children: int = 0
    child_ages: List[int] = []
    hotel_category: str = "4_star"
    flight_class: str = "economy"
    transport_type: str = "private_car"
    dietary: str = ""
    budget_flexibility: str = "strict"
    
    # Corporate fields
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    room_preference: str = "double"
    requires_gst_invoice: bool = False
    single_room_supplement: bool = False
    early_checkin_required: bool = False
    late_checkout_required: bool = False
    meeting_room_required: bool = False
    corporate_cancellation_terms: bool = False


class DayHotelOut(BaseModel):
    id: str
    name: str
    category: str
    meal_plan: str
    price_per_night: float
    location: Optional[str] = None
    image_url: Optional[str] = None


class DayActivityOut(BaseModel):
    id: str
    name: str
    duration: str
    timing: str
    price: float
    location: Optional[str] = None
    description: Optional[str] = None


class DayFlightOut(BaseModel):
    id: str
    airline: str
    flight_no: str
    origin: str
    destination: str
    cost: float
    class_: str = Field(default="Economy", alias="class")


class ItineraryDayOut(BaseModel):
    day_number: int
    title: str
    description: str
    sub_destination: Optional[str] = None
    hotels: List[DayHotelOut] = []
    activities: List[DayActivityOut] = []
    flights: List[DayFlightOut] = []
    transfers: List[Dict[str, Any]] = []
    meals: List[str] = []
    day_total: float = 0


class AssembledProposalOut(BaseModel):
    name: str
    destination: str
    duration_days: int
    total_price: float
    price_per_person: float
    currency: str = "INR"
    overview: str
    days: List[ItineraryDayOut]
    inclusions: List[str] = []
    exclusions: List[str] = []
    extra_sections: Dict[str, Any] = {}


class AssembleResponse(BaseModel):
    status: str
    proposal: Optional[AssembledProposalOut] = None
    detail: Optional[str] = None
    used_fallback: bool = False
