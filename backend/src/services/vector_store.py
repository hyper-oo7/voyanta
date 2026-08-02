"""
Vector store operations using Supabase pgvector.
Manages document chunk insertion, vector similarity search, and document deletion.
"""
import uuid
import logging
from typing import List, Dict, Any, Optional
from src.services.supabase_client import get_supabase_client
from src.core.config import get_settings

logger = logging.getLogger(__name__)

def get_supabase():
    return get_supabase_client()

class VectorStore:
    def __init__(self):
        settings = get_settings()
        self.dimension = settings.VECTOR_DIMENSION

    def store_chunks(
        self,
        agency_id: str,
        document_id: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> int:
        if len(chunks) != len(embeddings):
            raise ValueError(f"Chunks ({len(chunks)}) and embeddings ({len(embeddings)}) count mismatch")
        
        client = get_supabase()
        if not client:
            logger.warning("[VectorStore] Supabase client unavailable. Skipping chunk persistence.")
            return 0

        records = []
        for chunk, emb in zip(chunks, embeddings):
            records.append({
                "id": str(uuid.uuid4()),
                "agency_id": agency_id,
                "document_id": document_id,
                "content": chunk["content"],
                "embedding": emb,
                "metadata": chunk["metadata"],
                "source_type": chunk["metadata"].get("source_type", "pdf"),
            })
        
        try:
            client.table("document_chunks").insert(records).execute()
            logger.info(f"[VectorStore] Stored {len(records)} chunks for document_id={document_id}")
            return len(records)
        except Exception as e:
            logger.error(f"[VectorStore] Failed to insert document chunks: {e}")
            raise e

    def search(
        self,
        query_embedding: List[float],
        agency_id: str,
        k: int = 8,
        destination: Optional[str] = None,
        chunk_type: Optional[str] = None,
        min_similarity: float = 0.5,
    ) -> List[Dict[str, Any]]:
        client = get_supabase()
        if not client:
            logger.warning("[VectorStore] Supabase client unavailable for vector search.")
            return []

        params = {
            "query_embedding": query_embedding,
            "match_threshold": min_similarity,
            "match_count": k,
            "p_agency_id": agency_id,
        }
        if destination:
            params["filter_destination"] = destination.lower()
        if chunk_type:
            params["filter_chunk_type"] = chunk_type
            
        try:
            response = client.rpc("match_document_chunks", params).execute()
            results = response.data or []
            logger.info(f"[VectorStore] Search complete: found {len(results)} matches for agency_id={agency_id}")
            return results
        except Exception as e:
            logger.error(f"[VectorStore] Vector search failed: {e}")
            return []

    def delete_document_chunks(self, document_id: str) -> None:
        client = get_supabase()
        if not client:
            return
        try:
            client.table("document_chunks").delete().eq("document_id", document_id).execute()
            logger.info(f"[VectorStore] Deleted chunks for document_id={document_id}")
        except Exception as e:
            logger.error(f"[VectorStore] Failed to delete document chunks: {e}")

    def get_document_stats(self, agency_id: str) -> Dict[str, Any]:
        client = get_supabase()
        if not client:
            return {"total_chunks": 0, "agency_id": agency_id}
        try:
            resp = client.table("document_chunks").select("*", count="exact").eq("agency_id", agency_id).execute()
            return {
                "total_chunks": resp.count or 0,
                "agency_id": agency_id,
            }
        except Exception as e:
            logger.error(f"[VectorStore] Error fetching document stats: {e}")
            return {"total_chunks": 0, "agency_id": agency_id}

vector_store = VectorStore()
