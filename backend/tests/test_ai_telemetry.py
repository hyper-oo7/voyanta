import pytest
from unittest.mock import MagicMock, patch
from src.services.ai_telemetry_service import (
    estimate_cost,
    emit_llm_call,
    emit_rag_retrieval,
)

def test_estimate_cost():
    # 1000 input tokens, 2000 output tokens on gemini-2.5-flash
    # in: 1000 * 0.075 / 1e6 = 0.000075
    # out: 2000 * 0.30 / 1e6 = 0.000600
    # total = 0.000675
    cost = estimate_cost("gemini-2.5-flash", 1000, 2000)
    assert cost == 0.000675

@pytest.mark.anyio
async def test_emit_llm_call_live_and_cache_hit():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table

    with patch("src.services.supabase_client.get_supabase_client", return_value=mock_sb):
        # Emit live call
        emit_llm_call(
            provider="gemini",
            model="gemini-2.5-flash",
            latency_ms=450,
            tokens_in=500,
            tokens_out=250,
            cache_hit=False,
            agency_id="agency-1",
            entity_type="vault_package",
        )
        
        # Emit cache hit
        emit_llm_call(
            provider="cache",
            model="gemini-2.5-flash",
            latency_ms=0,
            tokens_in=500,
            tokens_out=250,
            cache_hit=True,
            agency_id="agency-1",
            entity_type="vault_package",
        )

@pytest.mark.anyio
async def test_emit_rag_retrieval():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table

    with patch("src.services.supabase_client.get_supabase_client", return_value=mock_sb):
        emit_rag_retrieval(
            agency_id="agency-1",
            destination="Kashmir",
            chunk_count=12,
            latency_ms=210,
            query_count=3,
        )
