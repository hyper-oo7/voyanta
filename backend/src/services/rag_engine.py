import time
import logging
from typing import List, Dict, Any, Optional
from src.services.embedder import embedder
from src.services.vector_store import vector_store
from src.core.config import get_settings
from src.services.ai_telemetry_service import emit_rag_retrieval

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
            # Sentence Window context replacement: use metadata context_window if available,
            # falling back to standard content for legacy stored chunks
            chunk_body = meta.get("context_window") or chunk.get("content", "")
            parts.append(
                f"[SOURCE {i}] From: {doc_name} | Section: {section} | Type: {chunk_type}\n"
                f"{chunk_body}\n"
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
        _t0 = time.monotonic()
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
        elapsed_ms = int((time.monotonic() - _t0) * 1000)
        try:
            emit_rag_retrieval(
                agency_id=agency_id,
                destination=destination,
                chunk_count=len(chunks),
                latency_ms=elapsed_ms,
                query_count=1,
            )
        except Exception as e:
            logger.debug(f"[RAGEngine] Telemetry emission skipped: {e}")

        context = self.format_context(chunks)
        return {
            "query": rag_query,
            "chunks": chunks,
            "context": context,
            "chunk_count": len(chunks),
        }

    def run_rag_by_type(
        self,
        agency_id: str,
        destination: str,
        duration_days: int = 7,
        k_per_query: int = 5
    ) -> Dict[str, Any]:
        """
        Executes distinct specialized queries (hotels, itineraries, rules)
        and merges the results to ensure diverse context.
        """
        _t0 = time.monotonic()
        queries = [
            f"{destination} hotel accommodation resorts premium",
            f"{destination} itinerary day plan activities sightseeing",
            f"{destination} inclusions exclusions terms conditions packing"
        ]
        
        all_chunks = []
        seen_hashes = set()
        
        for q in queries:
            chunks = self.retrieve(agency_id=agency_id, query=q, destination=destination, k=k_per_query)
            for chunk in chunks:
                chash = hash(chunk.get("content", "")[:100])
                if chash not in seen_hashes:
                    seen_hashes.add(chash)
                    all_chunks.append(chunk)
                    
        elapsed_ms = int((time.monotonic() - _t0) * 1000)
        try:
            emit_rag_retrieval(
                agency_id=agency_id,
                destination=destination,
                chunk_count=len(all_chunks),
                latency_ms=elapsed_ms,
                query_count=len(queries),
            )
        except Exception as e:
            logger.debug(f"[RAGEngine] Telemetry emission skipped: {e}")

        context = self.format_context(all_chunks)
        return {
            "query": f"Multi-Type RAG for {destination}",
            "chunks": all_chunks,
            "context": context,
            "chunk_count": len(all_chunks),
        }

    async def _embed_query_async(self, query: str) -> List[float]:
        """Runs blocking embedder in thread pool — never blocks the asyncio event loop."""
        import asyncio
        return await asyncio.to_thread(embedder.embed_query, query)

    async def retrieve_async(
        self,
        agency_id: str,
        query: str,
        destination: Optional[str] = None,
        k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Async version of retrieve() — runs embeddings and DB RPC in thread pool."""
        import asyncio
        k = k or self.top_k
        query_embedding = await self._embed_query_async(query)
        results = await asyncio.to_thread(
            vector_store.search,
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
        logger.info(f"[RAGEngine] Async retrieval: found {len(deduped)} unique chunks for '{query[:60]}'")
        return deduped

    async def retrieve_hierarchical_async(
        self,
        agency_id: str,
        query: str,
        destination: Optional[str] = None,
        top_docs: int = 3,
        k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        2-Stage Hierarchical Document Routing (LlamaIndex DocumentSummaryIndex pattern):
        Stage 1: Search document summary embeddings to isolate top relevant document IDs.
        Stage 2: Perform dense retrieval prioritizing chunks from those top documents.
        """
        import asyncio
        k = k or self.top_k
        query_embedding = await self._embed_query_async(query)

        # Stage 1: Document summary routing
        top_doc_ids = await asyncio.to_thread(
            vector_store.search_by_document_scope,
            query_embedding=query_embedding,
            agency_id=agency_id,
            top_docs=top_docs,
        )

        # Stage 2: Dense chunk retrieval
        results = await asyncio.to_thread(
            vector_store.search,
            query_embedding=query_embedding,
            agency_id=agency_id,
            k=k * 2 if top_doc_ids else k,
            destination=destination,
        )

        # If top_doc_ids were found, prioritize chunks from those documents
        if top_doc_ids:
            doc_id_set = set(top_doc_ids)
            scoped_results = [r for r in results if r.get("document_id") in doc_id_set]
            other_results = [r for r in results if r.get("document_id") not in doc_id_set]
            results = scoped_results + other_results

        seen_contents = set()
        deduped = []
        for r in results:
            content_hash = hash(r.get("content", "")[:100])
            if content_hash not in seen_contents:
                seen_contents.add(content_hash)
                deduped.append(r)

        logger.info(
            f"[RAGEngine] Hierarchical retrieval complete: {len(deduped[:k])} chunks "
            f"(scoped to {len(top_doc_ids)} docs) for query: '{query[:60]}'"
        )
        return deduped[:k]

    async def retrieve_hybrid_async(
        self,
        agency_id: str,
        query: str,
        destination: Optional[str] = None,
        k: Optional[int] = None,
        rrf_k: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid Vector + Full-Text Search with Reciprocal Rank Fusion (RRF).
        Fuses dense vector semantics with exact keyword/named-entity search in a single in-DB CTE.
        """
        import asyncio
        k = k or self.top_k
        query_embedding = await self._embed_query_async(query)
        results = await asyncio.to_thread(
            vector_store.search_hybrid,
            query_embedding=query_embedding,
            query_text=query,
            agency_id=agency_id,
            k=k,
            destination=destination,
            rrf_k=rrf_k,
        )
        seen_contents = set()
        deduped = []
        for r in results:
            content_hash = hash(r.get("content", "")[:100])
            if content_hash not in seen_contents:
                seen_contents.add(content_hash)
                deduped.append(r)
        logger.info(f"[RAGEngine] Hybrid retrieval complete: found {len(deduped)} unique chunks for '{query[:60]}'")
        return deduped

    async def run_rag_by_type_parallel(
        self,
        agency_id: str,
        destination: str,
        duration_days: int = 7,
        k_per_query: int = 5,
    ) -> Dict[str, Any]:
        """
        Parallel version of run_rag_by_type().
        Fires all specialized retrieval queries simultaneously via asyncio.gather().
        3-4x faster than sequential queries with diverse multi-faceted context.
        """
        import asyncio
        _t0 = time.monotonic()

        queries = [
            f"{destination} hotel accommodation resorts star category stay",
            f"{destination} itinerary day plan activities sightseeing tours",
            f"{destination} inclusions exclusions terms cancellation policy packing",
            f"{destination} transport vehicle transfer cab route distance",
        ]

        results = await asyncio.gather(
            *[self.retrieve_async(agency_id, q, destination, k_per_query) for q in queries],
            return_exceptions=True,
        )

        all_chunks: List[Dict[str, Any]] = []
        seen_hashes: set = set()
        failed_queries = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"[RAGEngine] Parallel query {i} failed: {result}")
                failed_queries += 1
                continue
            for chunk in result:
                chash = hash(chunk.get("content", "")[:100])
                if chash not in seen_hashes:
                    seen_hashes.add(chash)
                    all_chunks.append(chunk)

        # Sort by similarity score descending if available
        all_chunks.sort(key=lambda c: c.get("similarity", 0.0), reverse=True)

        elapsed_ms = int((time.monotonic() - _t0) * 1000)
        try:
            emit_rag_retrieval(
                agency_id=agency_id,
                destination=destination,
                chunk_count=len(all_chunks),
                latency_ms=elapsed_ms,
                query_count=len(queries) - failed_queries,
            )
        except Exception as e:
            logger.debug(f"[RAGEngine] Telemetry emission skipped: {e}")

        logger.info(
            f"[RAGEngine] Parallel RAG complete: {len(all_chunks)} chunks "
            f"from {len(queries) - failed_queries}/{len(queries)} queries in {elapsed_ms}ms"
        )

        context = self.format_context(all_chunks)
        return {
            "query": f"Parallel RAG for {destination}",
            "chunks": all_chunks[:20],
            "context": context,
            "chunk_count": len(all_chunks),
        }

    def rerank_chunks(self, chunks: List[Dict[str, Any]], query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Re-ranks chunks by calculating cosine similarity between the query embedding
        and chunk content embeddings.
        """
        if not chunks:
            return chunks
        try:
            query_emb = embedder.embed_query(query)
            for chunk in chunks:
                content_emb = embedder.embed_text(chunk.get("content", "")[:500])
                if len(query_emb) == len(content_emb) and len(query_emb) > 0:
                    dot = sum(a * b for a, b in zip(query_emb, content_emb))
                    chunk["rerank_score"] = dot
                else:
                    chunk["rerank_score"] = chunk.get("similarity", 0.0)

            return sorted(chunks, key=lambda c: c.get("rerank_score", 0.0), reverse=True)[:top_k]
        except Exception as e:
            logger.warning(f"[RAGEngine] Reranking fallback: {e}")
            return chunks[:top_k]

    async def rerank_chunks_llm(
        self,
        chunks: List[Dict[str, Any]],
        query: str,
        top_k: int = 8,
    ) -> List[Dict[str, Any]]:
        """
        Cross-encoder style reranking via a single batched LLM scoring prompt.
        Scores candidate chunks 1-10 for relevance to the search query.
        Falls back to bi-encoder rerank_chunks() on any exception or invalid format.
        """
        if not chunks or len(chunks) <= 1:
            return chunks[:top_k]
        try:
            from src.services.ai_client import call_llm
            candidates = chunks[:15]
            chunk_snippets = "\n".join(
                f"[{i+1}] {c.get('content', '')[:250].replace(chr(10), ' ')}"
                for i, c in enumerate(candidates)
            )
            scoring_prompt = (
                f"Query: {query}\n\n"
                f"Rate each numbered chunk's relevance to the query from 1 (irrelevant) to 10 (highly relevant).\n"
                f"Reply ONLY with a comma-separated list of {len(candidates)} integers (e.g. 8, 3, 9, ...):\n\n"
                f"Chunks:\n{chunk_snippets}"
            )
            raw = await call_llm(
                prompt=scoring_prompt,
                system_prompt="You are a strict relevance ranker. Return ONLY comma-separated integer scores.",
                temperature=0.0,
                max_tokens=60,
            )
            scores = [int(s.strip()) for s in raw.strip().split(",") if s.strip().isdigit()]
            if len(scores) == len(candidates):
                for i, chunk in enumerate(candidates):
                    chunk["llm_rerank_score"] = scores[i]
                return sorted(candidates, key=lambda c: c.get("llm_rerank_score", 0), reverse=True)[:top_k]
            else:
                logger.debug(f"[RAGEngine] LLM rerank score count mismatch: got {len(scores)}, expected {len(candidates)}")
        except Exception as e:
            logger.warning(f"[RAGEngine] LLM reranking failed ({e}); using bi-encoder fallback.")

        return self.rerank_chunks(chunks, query, top_k)

    async def retrieve_with_hyde(
        self,
        agency_id: str,
        destination: str,
        duration_days: int = 5,
        budget_inr: Optional[int] = None,
        k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        HyDE (Hypothetical Document Embeddings) retrieval.
        Generates a concise hypothetical supplier document snippet, embeds it,
        and uses that vector to search for semantically relevant chunks.
        """
        import asyncio
        from src.services.ai_client import call_llm

        budget_str = f"Budget: ₹{budget_inr:,} per person" if budget_inr else "Value-Comfort category"
        hypothesis_prompt = (
            f"Write a 3-sentence travel supplier package overview for:\n"
            f"Destination: {destination}\n"
            f"Duration: {duration_days} days\n"
            f"{budget_str}\n\n"
            f"Include: hotel star category, transport type, and 2 key attractions. "
            f"Be factual and use the terminology travel suppliers use."
        )

        try:
            hypothetical_doc = await call_llm(
                prompt=hypothesis_prompt,
                system_prompt="You are a travel supplier writing a factual itinerary summary.",
                temperature=0.2,
                max_tokens=300,
            )
        except Exception as e:
            logger.warning(f"[RAGEngine] HyDE generation failed ({e}), using destination query fallback.")
            hypothetical_doc = f"{destination} {duration_days} days travel package itinerary {budget_str}"

        k = k or self.top_k
        hyde_embedding = await self._embed_query_async(hypothetical_doc)
        results = await asyncio.to_thread(
            vector_store.search,
            query_embedding=hyde_embedding,
            agency_id=agency_id,
            k=k,
            destination=destination,
        )
        logger.info(f"[RAGEngine] HyDE retrieval complete: {len(results)} chunks for '{destination}'")
        return results

rag_engine = RAGEngine()
