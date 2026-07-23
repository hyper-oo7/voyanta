"""
test_ai_health.py
=================
Unit tests for the single authoritative AI health check endpoint /api/ai/health.
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_ai_health_unconfigured():
    with patch.dict("os.environ", {}, clear=True):
        resp = client.get("/api/ai/health")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "unhealthy"
        assert data["providers"]["gemini"]["configured"] is False
        assert data["providers"]["openai"]["configured"] is False

def test_ai_health_healthy():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "test_key"}):
        with patch("src.services.ai_client.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = "OK"
            resp = client.get("/api/ai/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
            assert data["active_models"]["gemini"] == "gemini-2.5-flash"
            assert data["active_models"]["openai"] == "gpt-4o-mini"
            assert data["providers"]["gemini"]["configured"] is True
            assert data["providers"]["gemini"]["status"] == "ok"
