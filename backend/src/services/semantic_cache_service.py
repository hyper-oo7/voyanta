import hashlib
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback cache for when DB table is not reachable or offline
_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}

def compute_content_hash(text: str, budget: float, duration: int) -> str:
    """
    Computes a SHA-256 hash of the cleaned text along with primary constraints
    to identify exact semantic matches for zero-cost caching.
    """
    normalized = f"{text.strip().lower()}|b:{round(budget, -2)}|d:{duration}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

async def get_cached_recommendation(hash_key: str, supabase_client=None) -> Optional[Dict[str, Any]]:
    """
    Checks Semantic Cache (pgvector / SHA hash match) for existing parsed JSON.
    Cost Impact: $0.00 (100% Free & Instant).
    """
    # 1. Check in-memory cache first
    if hash_key in _MEMORY_CACHE:
        logger.info(f"[Semantic Cache] HIT in memory for hash {hash_key[:8]}... ($0 cost)")
        return _MEMORY_CACHE[hash_key]

    # 2. Check Supabase database cache table if available
    if supabase_client:
        try:
            res = supabase_client.from_("semantic_cache").select("*").eq("hash", hash_key).maybe_single()
            if res and hasattr(res, "data") and res.data:
                logger.info(f"[Semantic Cache] HIT in Supabase DB for hash {hash_key[:8]}... ($0 cost)")
                parsed = res.data.get("parsed_json")
                if isinstance(parsed, str):
                    parsed = json.loads(parsed)
                _MEMORY_CACHE[hash_key] = parsed
                return parsed
        except Exception as e:
            logger.debug(f"[Semantic Cache] DB check bypassed: {e}")

    logger.info(f"[Semantic Cache] MISS for hash {hash_key[:8]}... Escalating to Model Cascading.")
    return None

async def store_cached_recommendation(
    hash_key: str,
    parsed_json: Dict[str, Any],
    destination: str,
    budget: float,
    supabase_client=None
) -> bool:
    """
    Stores generated structured JSON into the Semantic Cache for zero-cost future retrievals.
    """
    _MEMORY_CACHE[hash_key] = parsed_json

    if supabase_client:
        try:
            record = {
                "hash": hash_key,
                "destination": destination,
                "budget": budget,
                "parsed_json": json.dumps(parsed_json) if not isinstance(parsed_json, str) else parsed_json,
                "created_at": datetime.utcnow().isoformat()
            }
            supabase_client.from_("semantic_cache").upsert([record]).execute()
            logger.info(f"[Semantic Cache] Stored record in Supabase DB for hash {hash_key[:8]}...")
            return True
        except Exception as e:
            logger.debug(f"[Semantic Cache] Could not store in DB (in-memory saved): {e}")

    return True
