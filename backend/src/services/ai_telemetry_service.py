"""
ai_telemetry_service.py — Structured AI Event Telemetry
=========================================================
Records structured events for every LLM call, cache hit/miss, and RAG retrieval.
All database writes are fire-and-forget background tasks — never blocks the main pipeline.
"""
import json
import asyncio
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Model cost per 1M tokens (USD)
_COST_PER_1M_TOKENS = {
    "gemini-2.5-flash":    {"in": 0.075, "out": 0.30},
    "gemini-flash-latest": {"in": 0.075, "out": 0.30},
    "gemini-pro-latest":   {"in": 1.25,  "out": 5.00},
    "gpt-4o-mini":         {"in": 0.15,  "out": 0.60},
}


def estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    rates = _COST_PER_1M_TOKENS.get(model, {"in": 0.075, "out": 0.30})
    cost = (tokens_in * rates["in"] + tokens_out * rates["out"]) / 1_000_000
    return round(cost, 6)


async def _write_telemetry_record(record: Dict[str, Any]) -> None:
    """Write a single telemetry record to Supabase. Never raises."""
    try:
        from src.services.supabase_client import get_supabase_client
        sb = get_supabase_client()
        if not sb:
            return
        sb.table("ai_telemetry").insert(record).execute()
    except Exception as e:
        logger.debug(f"[Telemetry] Supabase write skipped: {e}")


def emit_llm_call(
    provider: str,
    model: str,
    latency_ms: int,
    tokens_in: int,
    tokens_out: int,
    cache_hit: bool = False,
    agency_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Fire-and-forget telemetry emission for LLM calls and cache events.
    Schedules a background DB write — the main pipeline is never blocked.
    """
    cost_usd = 0.0 if cache_hit else estimate_cost(model, tokens_in, tokens_out)
    record = {
        "event_type":    "cache_hit" if cache_hit else "llm_call",
        "provider":      provider,
        "model":         model,
        "agency_id":     agency_id,
        "entity_type":   entity_type or "general",
        "cache_hit":     cache_hit,
        "latency_ms":    latency_ms,
        "tokens_in_est": tokens_in,
        "tokens_out_est": tokens_out,
        "cost_usd_est":  cost_usd,
        "error":         error,
        "metadata":      metadata or {},
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_write_telemetry_record(record))
    except RuntimeError:
        # No running loop (e.g. CLI script or testing sync context)
        pass

    logger.info(json.dumps({
        "telemetry": "llm_call",
        "provider": provider,
        "model": model,
        "cache_hit": cache_hit,
        "latency_ms": latency_ms,
        "cost_usd_est": cost_usd,
        "agency_id": agency_id,
    }))


def emit_rag_retrieval(
    agency_id: str,
    destination: str,
    chunk_count: int,
    latency_ms: int,
    query_count: int = 1,
) -> None:
    """Emit telemetry for a RAG retrieval operation."""
    record = {
        "event_type":  "rag_retrieval",
        "agency_id":   agency_id,
        "entity_type": "rag",
        "cache_hit":   False,
        "latency_ms":  latency_ms,
        "metadata":    {
            "destination": destination,
            "chunk_count": chunk_count,
            "query_count": query_count,
        },
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_write_telemetry_record(record))
    except RuntimeError:
        pass

    logger.info(json.dumps({
        "telemetry": "rag_retrieval",
        "agency_id": agency_id,
        "destination": destination,
        "chunk_count": chunk_count,
        "latency_ms": latency_ms,
    }))
