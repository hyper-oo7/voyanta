"""
API Router for Retrieval-Augmented Generation (RAG) operations.
Exposes endpoints for querying RAG context, retrieving chunks, and checking vector stats.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel
import logging

from src.models.api_models import BaseResponse
from src.services.rag_engine import rag_engine
from src.services.vector_store import vector_store

from src.core.security import OptionalUser
from src.core.tenancy import resolve_agency_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG & Search"])

class RAGQueryResponse(BaseResponse):
    status: str = "success"
    data: dict

class RAGStatsResponse(BaseResponse):
    status: str = "success"
    data: dict

class RAGQueryRequest(BaseModel):
    destination: str
    duration_days: int = 5
    travelers: int = 2
    travel_style: str = "balanced"
    budget_inr: Optional[int] = None
    special_requests: Optional[str] = None
    agency_id: Optional[str] = None

@router.post("/query", response_model=RAGQueryResponse, summary="Execute RAG query against travel knowledge vector store")
async def execute_rag_query(
    payload: RAGQueryRequest,
    x_agency_id: Optional[str] = Header(None, alias="X-Agency-ID"),
    user: OptionalUser = None,
):
    # Must land on the same tenant the ingest path writes to; "global" here
    # against chunks written under another key is what returned 0 matches.
    agency_id = resolve_agency_id(user, payload.agency_id or x_agency_id)
    try:
        result = rag_engine.run_rag(
            agency_id=agency_id,
            destination=payload.destination,
            duration_days=payload.duration_days,
            travelers=payload.travelers,
            travel_style=payload.travel_style,
            budget_inr=payload.budget_inr,
            special_requests=payload.special_requests
        )
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"[RAGRouter] Error executing RAG query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=RAGStatsResponse, summary="Get vector store index statistics")
async def get_vector_stats(
    agency_id: Optional[str] = Query(None),
    user: OptionalUser = None,
):
    stats = vector_store.get_document_stats(agency_id=resolve_agency_id(user, agency_id))
    return {"status": "success", "data": stats}
