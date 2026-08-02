"""
Retrieval-Augmented Generation engine for travel proposals.
Builds contextual queries, retrieves relevant document chunks from vector store, and formats prompts for LLM synthesis.
"""
import logging
from typing import List, Dict, Any, Optional
from src.services.embedder import embedder
from src.services.vector_store import vector_store
from src.core.config import get_settings

logger = logging.getLogger(__name__)

class RAGEngine:
    def __init__(self):
        settings = get_settings()
        self.top_k = settings.TOP_K_RETRIEVAL
    
    def build_rag_query(
        self,
        destination: str,
        duration_days: int,
        travelers: int,
        travel_style: str,
        budget_inr: Optional[int] = None,
        special_requests: Optional[str] = None,
    ) -> str:
        query_parts = [
            f"{destination} travel itinerary",
            f"{duration_days} days",
            f"{travel_style} trip",
        ]
        if budget_inr:
            query_parts.append(f"budget around ₹{budget_inr}")
        if special_requests:
            query_parts.append(special_requests)
        query_parts.extend([
            f"{destination} hotels accommodation",
            f"{destination} activities sightseeing",
            f"{destination} day by day plan",
        ])
        return " ".join(query_parts)
    
    def retrieve(
        self,
        agency_id: str,
        query: str,
        destination: Optional[str] = None,
        k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        k = k or self.top_k
        query_embedding = embedder.embed_query(query)
        results = vector_store.search(
            query_embedding=query_embedding,
            agency_id=agency_id,
            k=k,
            destination=destination,
        )
        seen_contents = set()
        deduped = []
        for r in results:
            content_hash = hash(r.get("content", "")[:100])
            if content_hash not in seen_contents:
                seen_contents.add(content_hash)
                deduped.append(r)
        logger.info(f"[RAGEngine] Retrieval complete: found {len(deduped)} unique chunks for query: '{query[:80]}'")
        return deduped
    
    def format_context(self, chunks: List[Dict[str, Any]]) -> str:
        if not chunks:
            return "No previous documents found for this query."
        parts = []
        for i, chunk in enumerate(chunks, 1):
            meta = chunk.get("metadata", {})
            doc_name = meta.get("document_name", "Unknown document")
            section = meta.get("section_title", "General")
            chunk_type = meta.get("chunk_type", "general")
            parts.append(
                f"[SOURCE {i}] From: {doc_name} | Section: {section} | Type: {chunk_type}\n"
                f"{chunk.get('content', '')}\n"
            )
        return "\n\n".join(parts)
    
    def run_rag(
        self,
        agency_id: str,
        destination: str,
        duration_days: int,
        travelers: int,
        travel_style: str,
        budget_inr: Optional[int] = None,
        special_requests: Optional[str] = None,
    ) -> Dict[str, Any]:
        rag_query = self.build_rag_query(
            destination=destination,
            duration_days=duration_days,
            travelers=travelers,
            travel_style=travel_style,
            budget_inr=budget_inr,
            special_requests=special_requests,
        )
        chunks = self.retrieve(
            agency_id=agency_id,
            query=rag_query,
            destination=destination,
        )
        context = self.format_context(chunks)
        return {
            "query": rag_query,
            "chunks": chunks,
            "context": context,
            "chunk_count": len(chunks),
        }

rag_engine = RAGEngine()
