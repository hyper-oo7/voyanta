"""
test_fastapi_best_in_class.py
==============================
Validates enterprise FastAPI architecture:
1. Global exception handlers (422 Pydantic validation, 404/401 HTTP, 500 catch-all).
2. Rate-limiting standard headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset).
3. SSE real-time streaming endpoint (/api/ai/stream-generate).
4. Rich OpenAPI tags, schema metadata, and lifespan startup/shutdown.
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app, raise_server_exceptions=False)

def test_openapi_schema_metadata():
    """Verify rich OpenAPI documentation metadata and tags."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "Voyanta API"
    assert data["info"]["version"] == "3.0.0"
    tag_names = [t["name"] for t in data.get("tags", [])]
    assert "AI" in tag_names
    assert "PDF Generation" in tag_names
    assert "Super Admin Operations & Analytics" in tag_names

def test_validation_error_handler_422():
    """Ensure invalid request payloads produce structured JSON 422 responses with details."""
    # Send empty body to a required payload endpoint
    response = client.post("/api/enhance-text", json={})
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "Validation Error"
    assert "details" in data
    assert data["path"] == "/api/enhance-text"
    assert len(data["details"]) > 0

def test_http_exception_handler_404():
    """Ensure 404 and other HTTPExceptions produce structured JSON."""
    response = client.get("/api/non-existent-endpoint-xyz")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert data["status_code"] == 404
    assert data["path"] == "/api/non-existent-endpoint-xyz"

def test_rate_limit_headers_on_api_response():
    """Verify that X-RateLimit headers (Limit, Remaining, Reset) are present on API responses."""
    response = client.get("/api/destinations")
    # Endpoint should return 200 (or whatever status) with rate limit headers
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers
    assert "X-RateLimit-Reset" in response.headers
    assert int(response.headers["X-RateLimit-Limit"]) == 1000

@pytest.mark.anyio
@patch("src.api.routers.ai_router.stream_llm")
async def test_sse_stream_generate_endpoint(mock_stream_llm):
    """Test SSE streaming endpoint returning token chunks."""
    async def sample_generator(*args, **kwargs):
        yield "Day 1: "
        yield "Arrive in Srinagar. "
        yield "Check into luxury houseboat."

    mock_stream_llm.side_effect = sample_generator

    response = client.post(
        "/api/ai/stream-generate",
        json={"prompt": "Plan a 3-day luxury Kashmir itinerary"}
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    content = response.text
    assert 'data: {"token": "Day 1: "}' in content
    assert 'data: [DONE]' in content
