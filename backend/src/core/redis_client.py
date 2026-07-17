"""
redis_client.py — Upstash Redis & Standard Redis Connection Manager
======================================================================
Provides unified async Redis client access across rate limiting, semantic caching,
and distributed lock/cache services. Supports Upstash Redis over TLS (rediss://),
standard Redis (redis://), and Upstash REST API fallback.
"""

import os
import ssl
import json
import logging
import httpx
from typing import Optional, Any, Union

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    aioredis = None

# Global connection pool / client singleton
_async_redis_client: Optional[Any] = None


class UpstashRESTClient:
    """
    HTTP REST Client fallback for Upstash Redis when direct TCP/TLS port connection is blocked
    or when using Upstash Serverless REST endpoint directly via UPSTASH_REDIS_REST_URL.
    """
    def __init__(self, rest_url: str, rest_token: str):
        self.rest_url = rest_url.rstrip("/")
        self.rest_token = rest_token
        self.headers = {"Authorization": f"Bearer {self.rest_token}"}

    async def get(self, key: str) -> Optional[str]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(f"{self.rest_url}/get/{key}", headers=self.headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("result")
            except Exception as e:
                logger.warning(f"[UpstashREST] GET {key} failed: {e}")
        return None

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                url = f"{self.rest_url}/set/{key}/{value}"
                if ex:
                    url += f"/EX/{ex}"
                res = await client.post(url, headers=self.headers)
                if res.status_code == 200:
                    return res.json().get("result") in ("OK", True)
            except Exception as e:
                logger.warning(f"[UpstashREST] SET {key} failed: {e}")
        return False

    async def setex(self, key: str, time: int, value: str) -> bool:
        return await self.set(key, value, ex=time)

    async def incr(self, key: str) -> int:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(f"{self.rest_url}/incr/{key}", headers=self.headers)
                if res.status_code == 200:
                    return int(res.json().get("result", 0))
            except Exception as e:
                logger.warning(f"[UpstashREST] INCR {key} failed: {e}")
        return 0

    async def expire(self, key: str, seconds: int) -> bool:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(f"{self.rest_url}/expire/{key}/{seconds}", headers=self.headers)
                if res.status_code == 200:
                    return res.json().get("result", 0) == 1
            except Exception as e:
                logger.warning(f"[UpstashREST] EXPIRE {key} failed: {e}")
        return False

    async def delete(self, *keys: str) -> int:
        if not keys:
            return 0
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                url = f"{self.rest_url}/del/" + "/".join(keys)
                res = await client.post(url, headers=self.headers)
                if res.status_code == 200:
                    return int(res.json().get("result", 0))
            except Exception as e:
                logger.warning(f"[UpstashREST] DEL failed: {e}")
        return 0


def get_redis_client() -> Optional[Any]:
    """
    Returns an async Redis client instance configured from environment variables:
    - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (REST fallback/primary if configured)
    - REDIS_URL / UPSTASH_REDIS_URL (asyncio TCP/TLS client)
    """
    global _async_redis_client
    if _async_redis_client is not None:
        return _async_redis_client

    # Check Upstash REST config first or if aioredis is not installed
    rest_url = os.environ.get("UPSTASH_REDIS_REST_URL")
    rest_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if rest_url and rest_token:
        logger.info("[RedisClient] Initializing Upstash REST client using UPSTASH_REDIS_REST_URL")
        _async_redis_client = UpstashRESTClient(rest_url, rest_token)
        return _async_redis_client

    if not HAS_REDIS:
        logger.debug("[RedisClient] redis.asyncio is not installed and Upstash REST vars not set.")
        return None

    # Check connection URL
    redis_url = os.environ.get("UPSTASH_REDIS_URL") or os.environ.get("REDIS_URL") or os.environ.get("REDIS_HOST")
    if not redis_url:
        logger.debug("[RedisClient] No Redis configuration found in environment variables.")
        return None

    if not redis_url.startswith("redis"):
        redis_url = f"redis://{redis_url}:6379"

    try:
        connection_kwargs = {
            "encoding": "utf-8",
            "decode_responses": True,
        }
        # If Upstash TLS (rediss://), configure ssl context if needed
        if redis_url.startswith("rediss://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            connection_kwargs["ssl"] = ssl_context

        _async_redis_client = aioredis.from_url(redis_url, **connection_kwargs)
        logger.info(f"[RedisClient] Connected to Redis endpoint: {redis_url.split('@')[-1]}")
        return _async_redis_client
    except Exception as e:
        logger.error(f"[RedisClient] Failed to connect to Redis URL {redis_url}: {e}")
        return None


async def reset_redis_client():
    """Close and reset global client connection."""
    global _async_redis_client
    if _async_redis_client and hasattr(_async_redis_client, "aclose"):
        try:
            await _async_redis_client.aclose()
        except Exception:
            pass
    _async_redis_client = None
