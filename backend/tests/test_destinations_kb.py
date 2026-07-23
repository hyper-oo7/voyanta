"""
test_destinations_kb.py
=======================
Unit tests for India Destination Knowledge Base, sub-destinations, categorized activities,
and global stock photo auto-association endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_autocomplete_destinations_fallback():
    with patch("src.api.routers.destinations_router.get_supabase_client") as mock_sb:
        mock_table = MagicMock()
        mock_sb.return_value.table.return_value = mock_table
        mock_table.select.return_value.limit.return_value.execute.return_value = MagicMock(data=[
            {"id": "d1", "name": "Meghalaya", "state_or_ut": "Meghalaya"}
        ])

        response = client.get("/api/destinations/autocomplete?q=")
        assert response.status_code == 200
        data = response.json()
        assert "destinations" in data
        assert len(data["destinations"]) == 1
        assert data["destinations"][0]["name"] == "Meghalaya"

def test_autocomplete_meghalaya_sub_destinations():
    with patch("src.api.routers.destinations_router.get_supabase_client") as mock_sb:
        mock_table_dest = MagicMock()
        mock_table_sub = MagicMock()
        
        def table_side_effect(table_name):
            if table_name == "destinations":
                m = MagicMock()
                m.select.return_value.ilike.return_value.execute.return_value = MagicMock(data=[
                    {"id": "d111", "name": "Meghalaya", "state_or_ut": "Meghalaya"}
                ])
                return m
            elif table_name == "sub_destinations":
                m = MagicMock()
                m.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[
                    {"id": "s1", "name": "Shillong"},
                    {"id": "s2", "name": "Cherrapunji"},
                    {"id": "s3", "name": "Dawki"},
                    {"id": "s4", "name": "Mawlynnong"},
                    {"id": "s5", "name": "Nongriat"},
                    {"id": "s6", "name": "Mawsynram"},
                    {"id": "s7", "name": "Jowai"},
                    {"id": "s8", "name": "Garo Hills"}
                ])
                return m
            return MagicMock()

        mock_sb.return_value.table.side_effect = table_side_effect

        response = client.get("/api/destinations/autocomplete?q=Meghalaya")
        assert response.status_code == 200
        data = response.json()
        assert len(data["destinations"]) == 1
        assert len(data["sub_destinations"]) == 8
        sub_names = [s["name"] for s in data["sub_destinations"]]
        assert "Shillong" in sub_names
        assert "Cherrapunji" in sub_names
        assert "Dawki" in sub_names
        assert "Nongriat" in sub_names

def test_stock_image_global_persisted():
    with patch("src.api.routers.destinations_router.get_supabase_client") as mock_sb:
        mock_table = MagicMock()
        mock_sb.return_value.table.return_value = mock_table
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "s1", "hero_image_url": "https://images.unsplash.com/photo-test"}])

        # 1. Stock photo persistence MUST succeed
        resp_stock = client.post("/api/destinations/sub-destinations/s1/image", json={"image_url": "https://images.unsplash.com/photo-test", "image_source": "stock"})
        assert resp_stock.status_code == 200
        assert resp_stock.json()["success"] is True

        # 2. User upload photo MUST NOT persist globally to protect copyright
        resp_user = client.post("/api/destinations/sub-destinations/s1/image", json={"image_url": "blob:http://localhost/test", "image_source": "user"})
        assert resp_user.status_code == 200
        assert resp_user.json()["success"] is False
