"""Tests for DistributedRateLimiterMiddleware trusted proxy validation and rate limiting."""
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from src.core.rate_limiter import DistributedRateLimiterMiddleware

@pytest.fixture
def test_app():
    app = FastAPI()
    app.add_middleware(DistributedRateLimiterMiddleware, max_requests=2, window_seconds=60)
    
    @app.get("/test")
    async def endpoint(request: Request):
        return {"ip": request.client.host if request.client else "none"}
        
    return app

def test_trusted_proxy_uses_x_forwarded_for(test_app):
    client = TestClient(test_app)
    with patch.dict(os.environ, {"TRUSTED_PROXIES": "testclient,127.0.0.1"}):
        # By default TestClient uses "testclient" as request.client.host
        r1 = client.get("/test", headers={"X-Forwarded-For": "203.0.113.195, 70.41.3.18"})
        assert r1.status_code == 200
        assert r1.headers.get("X-RateLimit-Limit") == "2"

def test_untrusted_proxy_ignores_x_forwarded_for():
    app = FastAPI()
    limiter = DistributedRateLimiterMiddleware(app, max_requests=1, window_seconds=60)
    app.add_middleware(DistributedRateLimiterMiddleware, max_requests=1, window_seconds=60)
    
    @app.get("/test")
    async def endpoint():
        return {"ok": True}
        
    client = TestClient(app)
    with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.0.1"}):
        # testclient host is NOT 10.0.0.1, so X-Forwarded-For is ignored and immediate_ip ("testclient") is throttled
        r1 = client.get("/test", headers={"X-Forwarded-For": "1.1.1.1"})
        assert r1.status_code == 200
        
        # Second request from different X-Forwarded-For should still be throttled because immediate_ip is identical
        r2 = client.get("/test", headers={"X-Forwarded-For": "2.2.2.2"})
        assert r2.status_code == 429
        assert r2.json()["error"] == "Rate limit exceeded. Please slow down and try again later."
