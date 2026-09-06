"""
api_models.py
=============
Enterprise-grade typed Pydantic models for request payloads and API responses across Voyanta.
Supports automatic OpenAPI schema generation, serialization, and type validation.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, ConfigDict


# -------------------------------------------------------------
# Base & Common Generic Responses
# -------------------------------------------------------------
class BaseResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")


class ActionSuccessResponse(BaseResponse):
    success: bool = True
    message: Optional[str] = None
    detail: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class HealthResponse(BaseResponse):
    status: str = "ok"
    version: str = "3.0.0"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ok: Optional[bool] = None
    error: Optional[str] = None


class StatusCheck(BaseResponse):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseResponse):
    client_name: str


# -------------------------------------------------------------
# AI Router Models
# -------------------------------------------------------------
class ParseItineraryInput(BaseResponse):
    text: str


class StreamGenerateInput(BaseResponse):
    prompt: str
    system_prompt: Optional[str] = None
    provider: Optional[str] = None
    temperature: float = 0.0
    max_tokens: Optional[int] = None


class TranslateProposalInput(BaseResponse):
    proposal: Dict[str, Any]
    target_lang: str
    glossary: Dict[str, str] = Field(default_factory=dict)


class TranslateProposalResponse(BaseResponse):
    success: bool = True
    translated_proposal: Dict[str, Any]
    error: Optional[str] = None


class GenerateTitleInput(BaseResponse):
    destination: str = ""
    tour_type: str = ""
    duration: int = 7
    group_type: str = ""
    tour_category: str = ""


class GenerateTitleResponse(BaseResponse):
    success: bool = True
    title: str
    error: Optional[str] = None


class EnhanceTextInput(BaseResponse):
    text: str
    mode: str = "grammar"
    destination: str = ""
    length: Optional[str] = None
    format: Optional[str] = None
    tier: Optional[str] = None


class EnhanceTextResponse(BaseResponse):
    success: bool = True
    enhanced_text: str
    cached: Optional[bool] = None
    error: Optional[str] = None


# -------------------------------------------------------------
# PDF & PPT Generation Models
# -------------------------------------------------------------
class PDFGenerateRequest(BaseResponse):
    proposal_id: Optional[str] = None
    html: Optional[str] = None
    name: Optional[str] = None
    style: Optional[str] = None
    # The renderer loads /proposals/:id/print in a browser with no Supabase
    # session, so it falls back to the caller's cached copy of the proposal.
    # BaseResponse ignores unknown fields, so omitting this here silently
    # discarded that cache and every render answered "Proposal ... not found".
    local_storage: Optional[Dict[str, Any]] = None


class PDFGenerateResponse(BaseResponse):
    success: bool = True
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    message: Optional[str] = None
    filename: Optional[str] = None


class PDFPreviewResponse(BaseResponse):
    success: bool = True
    preview_url: Optional[str] = None
    pages: Optional[int] = None
    message: Optional[str] = None


class PDFParseResponse(BaseResponse):
    success: bool = True
    package_id: Optional[str] = None
    destination: Optional[str] = None
    title: Optional[str] = None
    days: List[Dict[str, Any]] = Field(default_factory=list)
    hotels: List[Dict[str, Any]] = Field(default_factory=list)
    inclusions: List[str] = Field(default_factory=list)
    exclusions: List[str] = Field(default_factory=list)
    extra_sections: Dict[str, Any] = Field(default_factory=dict)
    price_inr: Optional[float] = None
    currency: Optional[str] = None


class PPTGenerateRequest(BaseResponse):
    proposal: Dict[str, Any] = Field(default_factory=dict)
    items: List[Dict[str, Any]] = Field(default_factory=list)


class PPTGenerateResponse(BaseResponse):
    success: bool = True
    ppt_url: Optional[str] = None
    message: Optional[str] = None


# -------------------------------------------------------------
# Storage & Knowledge Models
# -------------------------------------------------------------
class StorageUploadResponse(BaseResponse):
    success: bool = True
    url: str
    key: Optional[str] = None
    content_type: Optional[str] = None


class StorageUrlResponse(BaseResponse):
    url: str
    expires_in: Optional[int] = None


class ImageSearchResult(BaseResponse):
    url: str
    thumbnail_url: Optional[str] = None
    title: Optional[str] = None
    source: Optional[str] = None


class ImageSearchResponse(BaseResponse):
    success: bool = True
    query: str
    images: List[ImageSearchResult] = Field(default_factory=list)
    count: int = 0


# -------------------------------------------------------------
# Packing Rules Models
# -------------------------------------------------------------
class PackingRuleItem(BaseResponse):
    id: Optional[str] = None
    destination: str
    sub_destination: Optional[str] = None
    items: List[str] = Field(default_factory=list)
    tips: List[str] = Field(default_factory=list)
    agency_id: Optional[str] = None
    created_at: Optional[str] = None


class PackingRulesListResponse(BaseResponse):
    success: bool = True
    rules: List[PackingRuleItem] = Field(default_factory=list)
    count: int = 0


# -------------------------------------------------------------
# Knowledge & RAG Models
# -------------------------------------------------------------
class RAGChunk(BaseResponse):
    id: Optional[str] = None
    content: str
    similarity: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    source_type: Optional[str] = None
    document_id: Optional[str] = None


class RAGRetrieveResponse(BaseResponse):
    success: bool = True
    query: str
    count: int
    chunks: List[RAGChunk] = Field(default_factory=list)


# -------------------------------------------------------------
# Destination Knowledge Models
# -------------------------------------------------------------
class DestinationItem(BaseResponse):
    destination: str
    overview: Optional[str] = None
    best_time: Optional[str] = None
    highlights: List[str] = Field(default_factory=list)
    sub_destinations: List[str] = Field(default_factory=list)


class DestinationListResponse(BaseResponse):
    success: bool = True
    destinations: List[Dict[str, Any]] = Field(default_factory=list)
    count: int = 0


# -------------------------------------------------------------
# Admin Analytics Models
# -------------------------------------------------------------
class AdminSummaryResponse(BaseResponse):
    status: str = "success"
    kpis: Dict[str, Any] = Field(default_factory=dict)
    recent_activity: List[Dict[str, Any]] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AdminLoginResponse(BaseResponse):
    success: bool = True
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


# -------------------------------------------------------------
# Vault & Import Response Models
# -------------------------------------------------------------
class VaultPackageListResponse(BaseResponse):
    status: str = "success"
    packages: List[Dict[str, Any]] = Field(default_factory=list)
    count: int = 0


class DestinationConfidenceResponse(BaseResponse):
    status: str = "success"
    destination: str
    confidence_score: int = 0
    pdfs: int = 0
    proposals: int = 0
    message: Optional[str] = None


class VaultPackageDetailResponse(BaseResponse):
    status: str = "success"
    package: Optional[Dict[str, Any]] = None


class VaultPackageDeleteResponse(BaseResponse):
    status: str = "success"
    message: str = "Package deleted"


class SubDestinationsResponse(BaseResponse):
    status: str = "success"
    sub_destinations: List[str] = Field(default_factory=list)


class DestinationKnowledgeResponse(BaseResponse):
    status: str = "success"
    destination: str
    knowledge: Dict[str, Any] = Field(default_factory=dict)
    sections_available: List[str] = Field(default_factory=list)


class KnowledgeUpsertResponse(BaseResponse):
    status: str = "success"
    saved: bool = True


class SectionTypesResponse(BaseResponse):
    section_types: Dict[str, str] = Field(default_factory=dict)


class RateConflictItem(BaseResponse):
    hotel_name: str
    variations: List[Dict[str, Any]] = Field(default_factory=list)


class RateConflictResponse(BaseResponse):
    status: str = "success"
    conflicts: List[RateConflictItem] = Field(default_factory=list)


class ImportProcessResponse(BaseResponse):
    status: str = "queued"
    job_id: str


class ImportStatusResponse(BaseResponse):
    status: str
    progress: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    raw_text: Optional[str] = None


class ImportConfirmResponse(BaseResponse):
    status: str = "success"
    message: str
    data: Optional[Dict[str, Any]] = None


class RawTextExtractResponse(BaseResponse):
    status: str = "success"
    text: str = ""
    message: Optional[str] = None


class VaultPDFProcessResponse(BaseResponse):
    status: str = "success"
    cache_hit: bool = False
    reparsed: Optional[bool] = None
    delta_summary: Optional[Dict[str, Any]] = None
    cost_incurred: Optional[str] = None
    storage_meta: Optional[Dict[str, Any]] = None
    compression_metrics: Optional[Dict[str, Any]] = None
    pdf_hash: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

