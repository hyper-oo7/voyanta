import os
import time
import logging
from typing import Dict, List, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    redis = None

class DistributedRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Enterprise-grade distributed rate limiter.
    Uses Redis when configured (REDIS_URL) for horizontal scaling across instances.
    Falls back gracefully to memory cache with automatic TTL eviction if Redis is offline.
    """
    def __init__(self, app, max_requests: int = 200, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.redis_client: Optional[Any] = None
        self._memory_cache: Dict[str, List[float]] = {}
        self._last_eviction = time.time()
        
        # Try initializing Redis if configured
        redis_url = os.environ.get("REDIS_URL") or os.environ.get("REDIS_HOST")
        if HAS_REDIS and redis_url:
            try:
                self.redis_client = redis.from_url(
                    redis_url if redis_url.startswith("redis") else f"redis://{redis_url}:6379",
                    encoding="utf-8",
                    decode_responses=True
                )
                logger.info("[RateLimiter] Connected to Redis distributed backend")
            except Exception as e:
                logger.warning(f"[RateLimiter] Redis init failed, falling back to local cache: {e}")
                self.redis_client = None

    async def _check_redis_limit(self, key: str, now: float) -> bool:
        """Returns True if request is allowed, False if rate limit exceeded."""
        try:
            bucket_key = f"ratelimit:{key}:{int(now // self.window_seconds)}"
            count = await self.redis_client.incr(bucket_key)
            if count == 1:
                await self.redis_client.expire(bucket_key, self.window_seconds * 2)
            return count <= self.max_requests
        except Exception as e:
            logger.warning(f"[RateLimiter] Redis check error ({e}), using memory fallback")
            return self._check_memory_limit(key, now)

    def _check_memory_limit(self, key: str, now: float) -> bool:
        """Memory sliding-window rate limit with automatic purge of stale keys."""
        # Periodic memory cleanup every window_seconds
        if now - self._last_eviction > self.window_seconds:
            stale_keys = []
            for k, timestamps in self._memory_cache.items():
                valid = [t for t in timestamps if now - t < self.window_seconds]
                if not valid:
                    stale_keys.append(k)
                else:
                    self._memory_cache[k] = valid
            for k in stale_keys:
                del self._memory_cache[k]
            self._last_eviction = now

        timestamps = self._memory_cache.get(key, [])
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
        
        if len(valid_timestamps) >= self.max_requests:
            self._memory_cache[key] = valid_timestamps
            return False
            
        valid_timestamps.append(now)
        self._memory_cache[key] = valid_timestamps
        return True

    async def dispatch(self, request: Request, call_next):
        # Exclude health endpoints from rate limiting
        if request.url.path in ("/api/health", "/api/pdf/health", "/api/ppt/health"):
            return await call_next(request)

        # Identity key: Only inspect X-Forwarded-For if immediate peer is a verified trusted proxy
        immediate_ip = request.client.host if request.client else "127.0.0.1"
        trusted_proxies_str = os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1,localhost")
        trusted_proxies = {p.strip() for p in trusted_proxies_str.split(",") if p.strip()}
        
        if immediate_ip in trusted_proxies and request.headers.get("x-forwarded-for"):
            key = request.headers.get("x-forwarded-for").split(",")[0].strip()
        else:
            key = immediate_ip
            
        now = time.time()

        allowed = True
        if self.redis_client:
            allowed = await self._check_redis_limit(key, now)
        else:
            allowed = self._check_memory_limit(key, now)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded. Please slow down and try again later.",
                    "window_seconds": self.window_seconds,
                    "max_requests": self.max_requests
                },
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        return response
