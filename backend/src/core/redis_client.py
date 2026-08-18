"""
redis_client.py — Upstash Redis & Standard Redis Connection Manager
======================================================================
Provides unified async Redis client access across rate limiting, semantic caching,
distributed job store, and distributed locking. Supports:
1. Native Upstash Redis over TLS (`rediss://`) via `redis.asyncio`
2. Standard Redis (`redis://`) via `redis.asyncio`
3. Upstash Serverless REST API with persistent connection pooling (`httpx.AsyncClient`)
4. Lazy connection health probing (60s PING check)
5. Distributed Redlock (SET NX PX) with Lua atomic release
"""

import os
import ssl
import json
import time
import uuid
import logging
import httpx
from typing import Optional, Any, Union, Dict, List, Tuple

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    aioredis = None

# Global connection pool / client singleton
_async_redis_client: Optional[Any] = None
_last_ping_time: float = 0.0
_PING_INTERVAL_SECONDS: float = 60.0


class UpstashRESTPipeline:
    """
    Simulates Redis pipeline for Upstash REST client so calling code can use
    the standard `pipeline(transaction=False)` syntax seamlessly.
    """
    def __init__(self, rest_client: "UpstashRESTClient"):
        self.rest_client = rest_client
        self.commands: List[Tuple[str, tuple, dict]] = []

    def incr(self, key: str):
        self.commands.append(("incr", (key,), {}))
        return self

    def incrby(self, key: str, amount: int):
        self.commands.append(("incrby", (key, amount), {}))
        return self

    def expire(self, key: str, seconds: int):
        self.commands.append(("expire", (key, seconds), {}))
        return self

    def set(self, key: str, value: str, ex: Optional[int] = None, px: Optional[int] = None, nx: bool = False):
        self.commands.append(("set", (key, value), {"ex": ex, "px": px, "nx": nx}))
        return self

    def setex(self, key: str, time_sec: int, value: str):
        self.commands.append(("setex", (key, time_sec, value), {}))
        return self

    def delete(self, *keys: str):
        self.commands.append(("delete", keys, {}))
        return self

    async def execute(self) -> List[Any]:
        results = []
        for cmd, args, kwargs in self.commands:
            fn = getattr(self.rest_client, cmd, None)
            if fn:
                res = await fn(*args, **kwargs)
                results.append(res)
            else:
                results.append(None)
        return results


class UpstashRESTClient:
    """
    High-performance HTTP REST Client for Upstash Redis.
    Uses a persistent httpx.AsyncClient with connection pooling
    to eliminate TCP handshake latency.
    """
    def __init__(self, rest_url: str, rest_token: str):
        self.rest_url = rest_url.rstrip("/")
        self.rest_token = rest_token
        self.headers = {"Authorization": f"Bearer {self.rest_token}"}
        # Persistent HTTP client with connection pooling and keepalive
        self._http = httpx.AsyncClient(
            base_url=self.rest_url,
            headers=self.headers,
            timeout=10.0,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
        )

    def pipeline(self, transaction: bool = False) -> UpstashRESTPipeline:
        return UpstashRESTPipeline(self)

    async def ping(self) -> bool:
        try:
            res = await self._http.get("/ping")
            if res.status_code == 200:
                data = res.json()
                return data.get("result") == "PONG"
        except Exception as e:
            logger.warning(f"[UpstashREST] PING failed: {e}")
        return False

    async def get(self, key: str) -> Optional[str]:
        try:
            res = await self._http.get(f"/get/{key}")
            if res.status_code == 200:
                data = res.json()
                return data.get("result")
        except Exception as e:
            logger.warning(f"[UpstashREST] GET {key} failed: {e}")
        return None

    async def set(
        self,
        key: str,
        value: str,
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False
    ) -> bool:
        try:
            url = f"/set/{key}/{value}"
            params = {}
            if nx:
                params["NX"] = "true"
            if ex:
                params["EX"] = str(ex)
            elif px:
                params["PX"] = str(px)

            res = await self._http.post(url, params=params if params else None)
            if res.status_code == 200:
                result = res.json().get("result")
                return result in ("OK", True, 1)
        except Exception as e:
            logger.warning(f"[UpstashREST] SET {key} failed: {e}")
        return False

    async def setex(self, key: str, time_sec: int, value: str) -> bool:
        return await self.set(key, value, ex=time_sec)

    async def incr(self, key: str) -> int:
        try:
            res = await self._http.post(f"/incr/{key}")
            if res.status_code == 200:
                return int(res.json().get("result", 0))
        except Exception as e:
            logger.warning(f"[UpstashREST] INCR {key} failed: {e}")
        return 0

    async def incrby(self, key: str, amount: int) -> int:
        try:
            res = await self._http.post(f"/incrby/{key}/{amount}")
            if res.status_code == 200:
                return int(res.json().get("result", 0))
        except Exception as e:
            logger.warning(f"[UpstashREST] INCRBY {key} failed: {e}")
        return 0

    async def expire(self, key: str, seconds: int) -> bool:
        try:
            res = await self._http.post(f"/expire/{key}/{seconds}")
            if res.status_code == 200:
                return res.json().get("result", 0) == 1
        except Exception as e:
            logger.warning(f"[UpstashREST] EXPIRE {key} failed: {e}")
        return False

    async def delete(self, *keys: str) -> int:
        if not keys:
            return 0
        try:
            url = "/del/" + "/".join(keys)
            res = await self._http.post(url)
            if res.status_code == 200:
                return int(res.json().get("result", 0))
        except Exception as e:
            logger.warning(f"[UpstashREST] DEL failed: {e}")
        return 0

    async def hset(self, key: str, mapping: Optional[Dict[str, Any]] = None, **kwargs: Any) -> int:
        """Sets field-value pairs in a hash."""
        pairs = {}
        if mapping:
            pairs.update(mapping)
        pairs.update(kwargs)
        if not pairs:
            return 0

        try:
            path_segments = [f"{k}/{v}" for k, v in pairs.items()]
            url = f"/hset/{key}/" + "/".join(path_segments)
            res = await self._http.post(url)
            if res.status_code == 200:
                return int(res.json().get("result", 0))
        except Exception as e:
            logger.warning(f"[UpstashREST] HSET {key} failed: {e}")
        return 0

    async def hget(self, key: str, field: str) -> Optional[str]:
        try:
            res = await self._http.get(f"/hget/{key}/{field}")
            if res.status_code == 200:
                return res.json().get("result")
        except Exception as e:
            logger.warning(f"[UpstashREST] HGET {key} {field} failed: {e}")
        return None

    async def hgetall(self, key: str) -> Dict[str, str]:
        try:
            res = await self._http.get(f"/hgetall/{key}")
            if res.status_code == 200:
                data = res.json().get("result", [])
                if isinstance(data, list):
                    result = {}
                    for i in range(0, len(data), 2):
                        if i + 1 < len(data):
                            result[str(data[i])] = str(data[i + 1])
                    return result
                elif isinstance(data, dict):
                    return {str(k): str(v) for k, v in data.items()}
        except Exception as e:
            logger.warning(f"[UpstashREST] HGETALL {key} failed: {e}")
        return {}

    async def hdel(self, key: str, *fields: str) -> int:
        if not fields:
            return 0
        try:
            url = f"/hdel/{key}/" + "/".join(fields)
            res = await self._http.post(url)
            if res.status_code == 200:
                return int(res.json().get("result", 0))
        except Exception as e:
            logger.warning(f"[UpstashREST] HDEL {key} failed: {e}")
        return 0

    async def aclose(self):
        """Closes the persistent HTTP client pool."""
        try:
            await self._http.aclose()
        except Exception:
            pass


def get_redis_client() -> Optional[Any]:
    """
    Returns an async Redis client instance configured from environment variables:
    - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (REST primary/fallback)
    - REDIS_URL / UPSTASH_REDIS_URL (asyncio TCP/TLS client)
    """
    global _async_redis_client
    if _async_redis_client is not None:
        return _async_redis_client

    # Check Upstash REST config first
    rest_url = os.environ.get("UPSTASH_REDIS_REST_URL")
    rest_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if rest_url and rest_token:
        logger.info("[RedisClient] Initializing persistent Upstash REST client")
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
        # If Upstash TLS (rediss://), configure ssl context
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


async def get_healthy_redis() -> Optional[Any]:
    """
    Returns an active Redis client with periodic health probing (every 60s).
    Automatically resets and attempts reconnect if connection drops.
    """
    global _async_redis_client, _last_ping_time
    client = get_redis_client()
    if client is None:
        return None

    now = time.time()
    if now - _last_ping_time > _PING_INTERVAL_SECONDS:
        try:
            if hasattr(client, "ping"):
                await client.ping()
            _last_ping_time = now
        except Exception as e:
            logger.warning(f"[RedisClient] Health probe PING failed ({e}), resetting connection...")
            await reset_redis_client()
            return get_redis_client()

    return client


async def acquire_lock(client: Any, lock_key: str, ttl_seconds: int = 60) -> Optional[str]:
    """
    Distributed lock acquisition using standard Redis `SET lock:{key} token NX PX ttl_ms`.
    Returns unique token string if lock acquired, None if locked by another worker.
    """
    if not client:
        return None
    token = str(uuid.uuid4())
    full_key = f"lock:{lock_key}"
    try:
        if hasattr(client, "set"):
            # Supports native aioredis and UpstashRESTClient
            acquired = await client.set(full_key, token, nx=True, px=int(ttl_seconds * 1000))
            if acquired:
                return token
    except Exception as e:
        logger.debug(f"[RedisLock] Failed to acquire lock for {lock_key}: {e}")
    return None


async def release_lock(client: Any, lock_key: str, token: str) -> bool:
    """
    Safely releases the distributed lock using atomic Lua script (or get-del fallback).
    Ensures a worker only deletes the lock if it still holds the matching token.
    """
    if not client or not token:
        return False
    full_key = f"lock:{lock_key}"
    try:
        if hasattr(client, "eval"):
            # Atomic Lua script for native redis
            lua_release = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """
            res = await client.eval(lua_release, 1, full_key, token)
            return bool(res)
        else:
            # Fallback for REST client without eval
            current = await client.get(full_key)
            if current == token:
                await client.delete(full_key)
                return True
    except Exception as e:
        logger.debug(f"[RedisLock] Failed to release lock for {lock_key}: {e}")
    return False


async def reset_redis_client():
    """Close and reset global client connection pool."""
    global _async_redis_client
    if _async_redis_client:
        if hasattr(_async_redis_client, "aclose"):
            try:
                await _async_redis_client.aclose()
            except Exception:
                pass
        elif hasattr(_async_redis_client, "close"):
            try:
                await _async_redis_client.close()
            except Exception:
                pass
    _async_redis_client = None
