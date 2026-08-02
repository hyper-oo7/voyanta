"""
Pydantic schemas for RAG, Document processing, and Proposal Generation.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ProposalStatus(str, Enum):
    DRAFT = "draft"
    SAVED = "saved"
    SENT = "sent"
    ACCEPTED = "accepted"

class DayPlan(BaseModel):
    day_number: int
    title: str
    description: str
    activities: List[str] = Field(default_factory=list)
    meals: Optional[str] = "Breakfast included"
    hotel_name: Optional[str] = "Selected Hotel"
    transport: Optional[str] = "Private Cab"
    tips: Optional[str] = None

class PricingBreakdown(BaseModel):
    category: str
    item: str
    cost_inr: Optional[int] = 0
    notes: Optional[str] = None

class GeneratedProposal(BaseModel):
    title: str
    subtitle: Optional[str] = None
    destination: str
    duration_days: int
    summary: str
    day_plans: List[DayPlan] = Field(default_factory=list)
    pricing: List[PricingBreakdown] = Field(default_factory=list)
    inclusions: List[str] = Field(default_factory=list)
    exclusions: List[str] = Field(default_factory=list)
    terms: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    raw_markdown: Optional[str] = None

class ProposalGenerateRequest(BaseModel):
    agency_id: str = "global"
    client_id: Optional[str] = None
    destination: str
    duration_days: int = 5
    travelers: int = 2
    travel_style: str = "family"
    budget_inr: Optional[int] = None
    special_requests: Optional[str] = None
    template_id: Optional[str] = None
    include_images: bool = True

class ProposalSaveRequest(BaseModel):
    agency_id: str = "global"
    client_id: Optional[str] = None
    template_id: Optional[str] = None
    generated_proposal: GeneratedProposal
    status: ProposalStatus = ProposalStatus.DRAFT

class ProposalSaveResponse(BaseModel):
    proposal_id: str
    public_url: str
    status: str

class DocumentUploadRequest(BaseModel):
    agency_id: str = "global"
    client_id: Optional[str] = None
    document_type: str = "pdf"
    tags: Optional[List[str]] = Field(default_factory=list)

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    chunks_indexed: int
    message: str
