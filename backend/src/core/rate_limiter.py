import os
import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    redis = None

class DistributedRateLimiterMiddleware:
    """
    Enterprise-grade pure ASGI distributed rate limiter (Zero-copy, Streaming/SSE-safe).
    Uses Redis when configured (REDIS_URL) for horizontal scaling across instances.
    Falls back gracefully to memory cache with automatic TTL eviction if Redis is offline.
    """
    def __init__(self, app: ASGIApp, max_requests: int = 1000, window_seconds: int = 60):
        self.app = app
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.redis_client: Optional[Any] = None
        self._memory_cache: Dict[str, List[float]] = {}
        self._last_eviction = time.time()
        
        # Try initializing Redis if configured
        try:
            from src.core.redis_client import get_redis_client
            self.redis_client = get_redis_client()
            if self.redis_client:
                logger.info("[RateLimiter] Connected to Redis/Upstash distributed backend (Pure ASGI)")
        except Exception as e:
            logger.warning(f"[RateLimiter] Redis init failed, falling back to local cache: {e}")
            self.redis_client = None

    async def _check_redis_limit(self, key: str, now: float) -> Tuple[bool, int, int]:
        """Returns (allowed: bool, remaining: int, reset_ttl: int)."""
        try:
            if not self.redis_client:
                from src.core.redis_client import get_redis_client
                self.redis_client = get_redis_client()
            if not self.redis_client:
                return self._check_memory_limit(key, now)

            bucket_key = f"ratelimit:{key}:{int(now // self.window_seconds)}"
            if hasattr(self.redis_client, "pipeline"):
                pipe = self.redis_client.pipeline(transaction=False)
                pipe.incr(bucket_key)
                pipe.expire(bucket_key, self.window_seconds * 2)
                results = await pipe.execute()
                count = int(results[0]) if results and results[0] is not None else 1
            else:
                count = await self.redis_client.incr(bucket_key)
                if count == 1:
                    await self.redis_client.expire(bucket_key, self.window_seconds * 2)

            allowed = count <= self.max_requests
            remaining = max(0, self.max_requests - count)
            reset_ttl = int(self.window_seconds - (now % self.window_seconds))
            return allowed, remaining, reset_ttl
        except Exception as e:
            logger.warning(f"[RateLimiter] Redis check error ({e}), using memory fallback")
            return self._check_memory_limit(key, now)

    def _check_memory_limit(self, key: str, now: float) -> Tuple[bool, int, int]:
        """Memory sliding-window rate limit with automatic purge of stale keys."""
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
            oldest = min(valid_timestamps) if valid_timestamps else now
            reset_ttl = max(1, int(self.window_seconds - (now - oldest)))
            return False, 0, reset_ttl
            
        valid_timestamps.append(now)
        self._memory_cache[key] = valid_timestamps
        remaining = max(0, self.max_requests - len(valid_timestamps))
        reset_ttl = int(self.window_seconds - (now % self.window_seconds))
        return True, remaining, reset_ttl

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Exclude health endpoints and public stock photo searches from rate limiting
        if path in ("/api/health", "/api/pdf/health", "/api/ppt/health", "/api/public/images/search"):
            await self.app(scope, receive, send)
            return

        # Parse client IP and X-Forwarded-For
        client = scope.get("client")
        immediate_ip = client[0] if client else "127.0.0.1"
        trusted_proxies_str = os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1,localhost,*")
        trusted_proxies = {p.strip() for p in trusted_proxies_str.split(",") if p.strip()}
        
        is_private_proxy = immediate_ip.startswith(("10.", "172.", "192.168.", "127.", "::1")) or "*" in trusted_proxies or immediate_ip in trusted_proxies
        
        headers = Headers(scope=scope)
        x_ff = headers.get("x-forwarded-for")
        if is_private_proxy and x_ff:
            key = x_ff.split(",")[0].strip()
        else:
            key = immediate_ip
            
        now = time.time()

        if self.redis_client:
            allowed, remaining, reset_ttl = await self._check_redis_limit(key, now)
        else:
            allowed, remaining, reset_ttl = self._check_memory_limit(key, now)

        if not allowed:
            response = JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded. Please slow down and try again later.",
                    "window_seconds": self.window_seconds,
                    "max_requests": self.max_requests
                },
                headers={
                    "Retry-After": str(reset_ttl),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + reset_ttl))
                }
            )
            await response(scope, receive, send)
            return

        # Allowed request: inject rate limit headers into http.response.start without buffering body chunks
        async def send_wrapper(message: Any) -> None:
            if message["type"] == "http.response.start":
                resp_headers = list(message.get("headers", []))
                resp_headers.append((b"x-ratelimit-limit", str(self.max_requests).encode("latin-1")))
                resp_headers.append((b"x-ratelimit-remaining", str(remaining).encode("latin-1")))
                resp_headers.append((b"x-ratelimit-reset", str(int(now + reset_ttl)).encode("latin-1")))
                message["headers"] = resp_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
