"""Backend tests for /api/pdf/* proxy."""
import os
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.main import app
from src.core.security import verify_token

app.dependency_overrides[verify_token] = lambda: {"id": "test-user"}
client = TestClient(app)


# --- /api/pdf/health -----------------------------------------------------
def test_pdf_health_returns_upstream_200():
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_res = AsyncMock()
        mock_res.status_code = 200
        mock_res.json = lambda: {"ok": True, "service": "voyanta-pdf", "port": 8002}
        mock_get.return_value = mock_res

        r = client.get("/api/pdf/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True


# --- /api/pdf/generate ---------------------------------------------------
SAMPLE_PAYLOAD = {
    "html": "<html><body><h1 style='color: #0a3d62;'>QA Test Proposal</h1><p>Test PDF Content</p></body></html>",
    "name": "QA Test Proposal",
}


def test_pdf_generate_returns_binary_pdf():
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_res = AsyncMock()
        mock_res.status_code = 200
        mock_res.content = b"%PDF-1.4 mock content for QA Test Proposal"
        mock_post.return_value = mock_res

        r = client.post("/api/pdf/generate", json=SAMPLE_PAYLOAD)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        disp = r.headers.get("content-disposition", "")
        assert "filename" in disp.lower()
        assert r.content[:4] == b"%PDF"


def test_pdf_generate_custom_name():
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_res = AsyncMock()
        mock_res.status_code = 200
        mock_res.content = b"%PDF-1.4 mock content for Custom Name"
        mock_post.return_value = mock_res

        payload = {"html": "<html><body><h1>Second Test</h1></body></html>", "name": "Custom-Name-Test"}
        r = client.post("/api/pdf/generate", json=payload)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert "Custom-Name-Test.pdf" in r.headers.get("content-disposition", "")
