"""Backend tests for /api/pdf/* proxy + Puppeteer service."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mock-to-dynamic.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/pdf/health -----------------------------------------------------
def test_pdf_health_returns_upstream_200(api):
    r = api.get(f"{BASE_URL}/api/pdf/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("upstream_status") == 200
    assert body.get("upstream", {}).get("ok") is True


# --- /api/pdf/generate ---------------------------------------------------
SAMPLE_PAYLOAD = {
    "proposal": {
        "id": "test-1",
        "name": "QA Test Proposal",
        "customer_name": "QA Tester",
        "destination": "Goa",
        "start_date": "2026-08-10",
        "end_date": "2026-08-15",
        "adults": 3,
        "children": 1,
        "currency": "INR",
    },
    "items_by_kind": {
        "transfer": [{"name": "Airport Transfer", "qty": 2, "unit_price": 1500, "currency": "INR"}]
    },
    "totals": {"subtotal": 3000, "currency": "INR"},
    "presentation": {"style": "premium"},
    "branding": {"agency_name": "Voyanta QA", "primary_color": "#0a3d62", "font_family": "Inter"},
}


def test_pdf_generate_returns_binary_pdf(api):
    r = api.post(f"{BASE_URL}/api/pdf/generate", json=SAMPLE_PAYLOAD, timeout=60)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    disp = r.headers.get("content-disposition", "")
    assert "filename" in disp.lower()
    # Magic bytes
    assert r.content[:4] == b"%PDF", f"First bytes: {r.content[:8]!r}"
    assert len(r.content) > 1000


def test_pdf_generate_dark_style(api):
    payload = {**SAMPLE_PAYLOAD, "presentation": {"style": "dark"}}
    r = api.post(f"{BASE_URL}/api/pdf/generate", json=payload, timeout=60)
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"
