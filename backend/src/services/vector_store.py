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

    def search_hybrid(
        self,
        query_embedding: List[float],
        query_text: str,
        agency_id: str,
        k: int = 8,
        destination: Optional[str] = None,
        chunk_type: Optional[str] = None,
        rrf_k: int = 60,
        vector_weight: float = 1.0,
        keyword_weight: float = 1.0,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid Vector + Full-Text Search with Reciprocal Rank Fusion (RRF).
        Fuses dense semantic similarity with exact keyword matching in a single in-DB CTE.
        Falls back to standard search() if hybrid RPC is unavailable.
        """
        client = get_supabase()
        if not client:
            return []

        params = {
            "query_embedding": query_embedding,
            "query_text": query_text,
            "match_count": k,
            "p_agency_id": agency_id,
            "rrf_k": rrf_k,
            "vector_weight": vector_weight,
            "keyword_weight": keyword_weight,
        }
        if destination:
            params["filter_destination"] = destination.lower()
        if chunk_type:
            params["filter_chunk_type"] = chunk_type

        try:
            response = client.rpc("match_document_chunks_hybrid", params).execute()
            results = response.data or []
            logger.info(f"[VectorStore] Hybrid search complete: found {len(results)} matches for agency_id={agency_id}")
            return results
        except Exception as e:
            logger.warning(f"[VectorStore] Hybrid search fallback to standard vector search: {e}")
            return self.search(
                query_embedding=query_embedding,
                agency_id=agency_id,
                k=k,
                destination=destination,
                chunk_type=chunk_type,
            )

    def search_exact(
        self,
        query_embedding: List[float],
        agency_id: str,
        k: int = 10,
        destination: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Exact linear scan for recall measurement diagnostics.
        """
        client = get_supabase()
        if not client:
            return []
        try:
            return self.search(
                query_embedding=query_embedding,
                agency_id=agency_id,
                k=k,
                destination=destination,
                min_similarity=0.0,
            )
        except Exception as e:
            logger.error(f"[VectorStore] Exact search failed: {e}")
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
    def store_document_summary(
        self,
        document_id: str,
        agency_id: str,
        summary_text: str,
        summary_embedding: List[float],
        table_name: str = "documents",
    ) -> None:
        """Store doc-level summary + embedding for routing."""
        client = get_supabase()
        if not client:
            return
        try:
            client.table(table_name).update({
                "summary_text": summary_text,
                "summary_embedding": summary_embedding,
            }).eq("id", document_id).execute()
            logger.info(f"[VectorStore] Stored summary embedding for document_id={document_id} in {table_name}")
        except Exception as e:
            logger.warning(f"[VectorStore] Failed to store summary embedding: {e}")

    def search_by_document_scope(
        self,
        query_embedding: List[float],
        agency_id: str,
        top_docs: int = 3,
        min_similarity: float = 0.3,
    ) -> List[str]:
        """Return top-N document IDs most relevant to the query for 2-stage hierarchical routing."""
        client = get_supabase()
        if not client:
            return []
        try:
            response = client.rpc("match_document_summaries", {
                "query_embedding": query_embedding,
                "p_agency_id": agency_id,
                "match_count": top_docs,
                "match_threshold": min_similarity,
            }).execute()
            doc_ids = [str(r["id"]) for r in (response.data or []) if "id" in r]
            logger.info(f"[VectorStore] Document-scope search matched {len(doc_ids)} documents for agency_id={agency_id}")
            return doc_ids
        except Exception as e:
            logger.warning(f"[VectorStore] Doc-scope search failed: {e}")
            return []

vector_store = VectorStore()
