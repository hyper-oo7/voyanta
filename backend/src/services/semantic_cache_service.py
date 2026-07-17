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

async def get_cached_recommendation(hash_key: str, supabase_client=None, agency_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Checks Semantic Cache (Upstash Redis / pgvector / SHA hash match) for existing parsed JSON.
    Cost Impact: $0.00 (100% Free & Instant).
    """
    mem_key = f"{agency_id or 'global'}_{hash_key}"
    # 1. Check in-memory cache first
    if mem_key in _MEMORY_CACHE:
        logger.info(f"[Semantic Cache] HIT in memory for hash {hash_key[:8]}... ($0 cost)")
        return _MEMORY_CACHE[mem_key]

    # 2. Check Upstash / Redis distributed cache
    try:
        from src.core.redis_client import get_redis_client
        redis_client = get_redis_client()
        if redis_client:
            redis_key = f"semantic_cache:{mem_key}"
            cached_str = await redis_client.get(redis_key)
            if cached_str:
                logger.info(f"[Semantic Cache] HIT in Upstash Redis for hash {hash_key[:8]}... ($0 cost)")
                parsed = json.loads(cached_str) if isinstance(cached_str, str) else cached_str
                _MEMORY_CACHE[mem_key] = parsed
                return parsed
    except Exception as e:
        logger.debug(f"[Semantic Cache] Redis check bypassed: {e}")

    # 3. Check Supabase database cache table if available
    if supabase_client:
        try:
            query = supabase_client.from_("semantic_cache").select("*").eq("hash", hash_key)
            if agency_id:
                query = query.eq("agency_id", agency_id)
            res = query.maybe_single()
            if res and hasattr(res, "data") and res.data:
                logger.info(f"[Semantic Cache] HIT in Supabase DB for hash {hash_key[:8]}... ($0 cost)")
                parsed = res.data.get("parsed_json")
                if isinstance(parsed, str):
                    parsed = json.loads(parsed)
                _MEMORY_CACHE[mem_key] = parsed
                # Also warm Redis cache
                try:
                    from src.core.redis_client import get_redis_client
                    rc = get_redis_client()
                    if rc:
                        await rc.setex(f"semantic_cache:{mem_key}", 2592000, json.dumps(parsed))
                except Exception:
                    pass
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
    supabase_client=None,
    agency_id: Optional[str] = None
) -> bool:
    """
    Stores generated structured JSON into the Semantic Cache (Upstash Redis + DB) for zero-cost future retrievals.
    """
    mem_key = f"{agency_id or 'global'}_{hash_key}"
    _MEMORY_CACHE[mem_key] = parsed_json
    json_str = json.dumps(parsed_json) if not isinstance(parsed_json, str) else parsed_json

    # Store in Upstash Redis (30-day TTL = 2,592,000 seconds)
    try:
        from src.core.redis_client import get_redis_client
        redis_client = get_redis_client()
        if redis_client:
            await redis_client.setex(f"semantic_cache:{mem_key}", 2592000, json_str)
            logger.info(f"[Semantic Cache] Stored record in Upstash Redis for hash {hash_key[:8]}...")
    except Exception as e:
        logger.debug(f"[Semantic Cache] Could not store in Redis: {e}")

    if supabase_client:
        try:
            record = {
                "hash": hash_key,
                "destination": destination,
                "budget": budget,
                "parsed_json": json_str,
                "created_at": datetime.utcnow().isoformat()
            }
            if agency_id:
                record["agency_id"] = agency_id
            supabase_client.from_("semantic_cache").upsert([record]).execute()
            logger.info(f"[Semantic Cache] Stored record in Supabase DB for hash {hash_key[:8]}...")
            return True
        except Exception as e:
            logger.debug(f"[Semantic Cache] Could not store in DB (in-memory saved): {e}")

    return True

