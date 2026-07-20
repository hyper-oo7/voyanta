import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from src.main import app
from src.services.vault_knowledge_service import get_destination_knowledge


def test_vault_endpoints_knowledge_and_match_rules():
    """Verify both /api/vault/knowledge and /api/vault/match-rules return 200 OK and unified knowledge."""
    client = TestClient(app)

    mock_knowledge = {
        "inclusions": {
            "title": "What's Included",
            "content": "Breakfast and Dinner included.",
            "source_count": 2,
        },
        "what_to_pack": {
            "title": "Packing Guidelines",
            "content": "Heavy woolens and boots.",
            "source_count": 1,
        }
    }

    with patch("src.api.routers.vault_router.get_destination_knowledge", return_value=mock_knowledge):
        # Test /api/vault/knowledge
        res1 = client.get("/api/vault/knowledge?destination=Ladakh")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "success"
        assert data1["destination"] == "Ladakh"
        assert "inclusions" in data1["knowledge"]
        assert "what_to_pack" in data1["knowledge"]

        # Test /api/vault/match-rules
        res2 = client.get("/api/vault/match-rules?destination=Ladakh")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "success"
        assert data2["destination"] == "Ladakh"
        assert "inclusions" in data2["knowledge"]
        assert "what_to_pack" in data2["knowledge"]


def test_get_destination_knowledge_merges_packing_rules():
    """Verify get_destination_knowledge unifies destination_knowledge and agency_packing_rules (Rule 5)."""
    mock_sb = MagicMock()

    # Mock destination_knowledge query response
    mock_dest_res = MagicMock()
    mock_dest_res.data = [
        {"section_type": "inclusions", "section_title": "Included", "content": "Hotel & transport.", "source_count": 3}
    ]

    # Mock agency_packing_rules query response
    mock_packing_res = MagicMock()
    mock_packing_res.data = [
        {"destination_keyword": "ladakh", "section_type": "what_to_pack", "section_title": "Packing Guidelines", "content": "Thermal layers."}
    ]

    # Configure table mocks
    def mock_table(name):
        if name == "destination_knowledge":
            table_mock = MagicMock()
            table_mock.select.return_value.ilike.return_value.eq.return_value.execute.return_value = mock_dest_res
            return table_mock
        elif name == "agency_packing_rules":
            table_mock = MagicMock()
            table_mock.select.return_value.eq.return_value.execute.return_value = mock_packing_res
            return table_mock
        return MagicMock()

    mock_sb.table.side_effect = mock_table

    with patch("src.services.supabase_client.get_supabase_client", return_value=mock_sb):
        knowledge = get_destination_knowledge("Ladakh", agency_id="agency-123")
        assert "inclusions" in knowledge
        assert knowledge["inclusions"]["content"] == "Hotel & transport."
        assert "what_to_pack" in knowledge
        assert knowledge["what_to_pack"]["content"] == "Thermal layers."
        assert knowledge["what_to_pack"]["title"] == "Packing Guidelines"
