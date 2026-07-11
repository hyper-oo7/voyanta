import hashlib
import json
import logging
from typing import Optional, Tuple
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

def compute_cache_key(agency_id: Optional[str], model: str, prompt_version: str, schema_version: str, normalized_input: str) -> Tuple[str, str]:
    """
    Computes a deterministic cache key and input hash.
    """
    cleaned_input = normalized_input.strip()
    input_hash = hashlib.sha256(cleaned_input.encode("utf-8")).hexdigest()
    
    agency_part = str(agency_id) if agency_id else "global"
    cache_string = f"{agency_part}:{model}:{prompt_version}:{schema_version}:{input_hash}"
    cache_key = hashlib.sha256(cache_string.encode("utf-8")).hexdigest()
    
    return cache_key, input_hash

async def get_cached_extraction(
    agency_id: Optional[str],
    model: str,
    prompt_version: str,
    schema_version: str,
    normalized_input: str
) -> Optional[dict]:
    """
    Searches the ai_cache for a matching key. If found, increments cache hits.
    """
    sb = get_supabase_client()
    if not sb:
        return None
        
    cache_key, _ = compute_cache_key(agency_id, model, prompt_version, schema_version, normalized_input)
    
    try:
        res = sb.table("ai_cache").select("output_json").eq("cache_key", cache_key).maybeSingle().execute()
        if res.data and res.data.get("output_json"):
            output = res.data["output_json"]
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except Exception:
                    pass
            
            # Increment hit stats
            saved_tokens = (len(normalized_input) + len(json.dumps(output))) // 4
            await increment_hits(saved_tokens)
            logger.info(f"[AICache] Cache HIT for key: {cache_key} (Saved ~{saved_tokens} tokens)")
            return output
    except Exception as e:
        logger.error(f"[AICache] Failed to lookup cache: {e}")
        
    # Increment miss stats
    await increment_misses()
    return None

async def save_cached_extraction(
    agency_id: Optional[str],
    entity_type: Optional[str],
    entity_id: Optional[str],
    model: str,
    prompt_version: str,
    schema_version: str,
    normalized_input: str,
    output_json: dict,
    confidence: Optional[float] = None
):
    """
    Saves the structured extraction output to the cache database.
    """
    sb = get_supabase_client()
    if not sb:
        return
        
    cache_key, input_hash = compute_cache_key(agency_id, model, prompt_version, schema_version, normalized_input)
    
    try:
        record = {
            "cache_key": cache_key,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "model": model,
            "prompt_version": prompt_version,
            "schema_version": schema_version,
            "input_hash": input_hash,
            "output_json": output_json,
            "confidence": confidence
        }
        if agency_id:
            record["agency_id"] = agency_id
            
        sb.table("ai_cache").upsert(record).execute()
        logger.info(f"[AICache] Cached extraction successfully under key: {cache_key}")
    except Exception as e:
        logger.error(f"[AICache] Failed to store cache record: {e}")

async def increment_hits(saved_tokens: int):
    """
    Atomically increments cache hit counts and token savings estimate.
    """
    sb = get_supabase_client()
    if not sb:
        return
    try:
        # Fetch current stats
        res = sb.table("ai_cache_stats").select("*").eq("id", "global").maybeSingle().execute()
        if res.data:
            current_hits = res.data.get("cache_hits") or 0
            current_tokens = res.data.get("saved_tokens_estimate") or 0
            sb.table("ai_cache_stats").update({
                "cache_hits": current_hits + 1,
                "saved_tokens_estimate": current_tokens + saved_tokens
            }).eq("id", "global").execute()
    except Exception as e:
        logger.error(f"[AICache] Failed to increment hits: {e}")

async def increment_misses():
    """
    Atomically increments cache miss counts.
    """
    sb = get_supabase_client()
    if not sb:
        return
    try:
        res = sb.table("ai_cache_stats").select("cache_misses").eq("id", "global").maybeSingle().execute()
        if res.data:
            current_misses = res.data.get("cache_misses") or 0
            sb.table("ai_cache_stats").update({
                "cache_misses": current_misses + 1
            }).eq("id", "global").execute()
    except Exception as e:
        logger.error(f"[AICache] Failed to increment misses: {e}")

async def get_cache_stats() -> dict:
    """
    Returns global cache statistics.
    """
    sb = get_supabase_client()
    if not sb:
        return {"cache_hits": 0, "cache_misses": 0, "saved_tokens_estimate": 0}
    try:
        res = sb.table("ai_cache_stats").select("*").eq("id", "global").maybeSingle().execute()
        if res.data:
            return {
                "cache_hits": res.data.get("cache_hits") or 0,
                "cache_misses": res.data.get("cache_misses") or 0,
                "saved_tokens_estimate": res.data.get("saved_tokens_estimate") or 0
            }
    except Exception as e:
        logger.error(f"[AICache] Failed to fetch cache stats: {e}")
    return {"cache_hits": 0, "cache_misses": 0, "saved_tokens_estimate": 0}

async def invalidate_cache(cache_key: str) -> bool:
    """
    Removes a cached item by key.
    """
    sb = get_supabase_client()
    if not sb:
        return False
    try:
        sb.table("ai_cache").delete().eq("cache_key", cache_key).execute()
        logger.info(f"[AICache] Invalidated cache key: {cache_key}")
        return True
    except Exception as e:
        logger.error(f"[AICache] Failed to invalidate cache key {cache_key}: {e}")
    return False
