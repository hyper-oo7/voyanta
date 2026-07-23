"""
test_admin_analytics.py
========================
Unit tests for Super Admin Analytics API & Admin Login / Add / Remove Admin endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app
from src.core.security import verify_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()

def test_admin_analytics_unauthorized():
    app.dependency_overrides[verify_token] = lambda: {"id": "u1", "role": "agent"}
    resp = client.get("/api/admin/analytics/summary")
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

def test_admin_analytics_summary_owner():
    app.dependency_overrides[verify_token] = lambda: {"id": "u1", "role": "owner"}
    with patch("src.api.routers.admin_analytics_router.get_supabase_client") as mock_sb:
        m_table = MagicMock()
        mock_sb.return_value.table.return_value = m_table
        
        m_table.select.return_value.execute.return_value = MagicMock(data=[], count=10)
        m_table.select.return_value.gte.return_value.execute.return_value = MagicMock(data=[], count=2)

        resp = client.get("/api/admin/analytics/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "kpis" in data

def test_admin_login_success():
    with patch("src.api.routers.admin_analytics_router.get_supabase_client") as mock_sb:
        m_table = MagicMock()
        mock_sb.return_value.table.return_value = m_table
        m_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
            {"id": "a1", "email": "admin@voyanta.com", "role": "admin", "password_hash": None}
        ])

        resp = client.post("/api/admin/login", json={"email": "admin@voyanta.com", "password": "anypassword"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "token" in data

def test_add_admin_user():
    app.dependency_overrides[verify_token] = lambda: {"id": "u1", "role": "owner"}
    with patch("src.api.routers.admin_analytics_router.get_supabase_client") as mock_sb:
        m_table = MagicMock()
        mock_sb.return_value.table.return_value = m_table
        m_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.post("/api/admin/users/add", json={"email": "newadmin@gmail.com", "password": "secretpassword"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

def test_remove_admin_user():
    app.dependency_overrides[verify_token] = lambda: {"id": "u1", "role": "owner"}
    with patch("src.api.routers.admin_analytics_router.get_supabase_client") as mock_sb:
        m_table = MagicMock()
        mock_sb.return_value.table.return_value = m_table

        resp = client.delete("/api/admin/users/u2")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
