import pytest
from unittest.mock import MagicMock, patch
from src.services.vector_store import VectorStore
from src.services.rag_engine import rag_engine

def test_vector_store_search_hybrid_success():
    store = VectorStore()
    mock_sb = MagicMock()
    mock_rpc_exec = MagicMock()
    mock_rpc_exec.execute.return_value.data = [
        {
            "id": "chunk-1",
            "content": "Hotel Snow Valley Manali Luxury Resort",
            "metadata": {"destination": "Manali", "chunk_type": "hotel"},
            "source_type": "pdf",
            "document_id": "doc-1",
            "similarity": 0.032,
            "vector_rank": 1,
            "keyword_rank": 1,
        },
        {
            "id": "chunk-2",
            "content": "Solang valley paragliding activity",
            "metadata": {"destination": "Manali", "chunk_type": "activity"},
            "source_type": "pdf",
            "document_id": "doc-1",
            "similarity": 0.016,
            "vector_rank": 2,
            "keyword_rank": None,
        }
    ]
    mock_sb.rpc.return_value = mock_rpc_exec

    with patch("src.services.vector_store.get_supabase", return_value=mock_sb):
        results = store.search_hybrid(
            query_embedding=[0.1] * 768,
            query_text="Hotel Snow Valley Manali",
            agency_id="agency-123",
            k=2,
            destination="Manali",
            rrf_k=60,
        )
        assert len(results) == 2
        assert results[0]["id"] == "chunk-1"
        assert results[0]["keyword_rank"] == 1
        # A read now covers the caller's agency AND the shared default pool,
        # where knowledge ingested before login lives. One call per tenant.
        from src.core.tenancy import DEFAULT_AGENCY_ID
        base = {
            "query_embedding": [0.1] * 768,
            "query_text": "Hotel Snow Valley Manali",
            "match_count": 2,
            "rrf_k": 60,
            "vector_weight": 1.0,
            "keyword_weight": 1.0,
            "filter_destination": "manali",
        }
        assert mock_sb.rpc.call_count == 2
        called_tenants = [call.args[1]["p_agency_id"] for call in mock_sb.rpc.call_args_list]
        assert called_tenants == ["agency-123", DEFAULT_AGENCY_ID]
        for call in mock_sb.rpc.call_args_list:
            assert call.args[0] == "match_document_chunks_hybrid"
            assert {k: v for k, v in call.args[1].items() if k != "p_agency_id"} == base

def test_vector_store_search_hybrid_fallback():
    store = VectorStore()
    mock_sb = MagicMock()
    # Simulate RPC failure (e.g. migration pending)
    mock_sb.rpc.side_effect = Exception("RPC match_document_chunks_hybrid not found")

    with patch("src.services.vector_store.get_supabase", return_value=mock_sb), \
         patch.object(store, "search", return_value=[{"id": "chunk-fallback", "content": "Fallback content"}]):
        results = store.search_hybrid(
            query_embedding=[0.1] * 768,
            query_text="Kashmir Dal Lake",
            agency_id="agency-123",
            k=5,
        )
        assert len(results) == 1
        assert results[0]["id"] == "chunk-fallback"

def test_vector_store_search_exact():
    store = VectorStore()
    mock_sb = MagicMock()
    mock_rpc_exec = MagicMock()
    mock_rpc_exec.execute.return_value.data = [{"id": "exact-1", "similarity": 0.99}]
    mock_sb.rpc.return_value = mock_rpc_exec

    with patch("src.services.vector_store.get_supabase", return_value=mock_sb):
        results = store.search_exact(
            query_embedding=[0.1] * 768,
            agency_id="agency-123",
            k=5,
            destination="Kashmir",
        )
        assert len(results) == 1
        assert results[0]["id"] == "exact-1"

@pytest.mark.anyio
async def test_rag_engine_retrieve_hybrid_async():
    mock_hybrid_results = [
        {"content": "Hotel Snow Valley in Manali", "similarity": 0.033, "metadata": {"section_title": "Hotels"}},
        {"content": "Solang Valley adventure activities", "similarity": 0.016, "metadata": {"section_title": "Activities"}},
    ]

    with patch("src.services.embedder.embedder.embed_query", return_value=[0.1] * 768), \
         patch("src.services.vector_store.vector_store.search_hybrid", return_value=mock_hybrid_results):
        res = await rag_engine.retrieve_hybrid_async(
            agency_id="agency-123",
            query="Hotel Snow Valley in Manali",
            destination="Manali",
            k=2,
            rrf_k=60,
        )
        assert len(res) == 2
        assert "Hotel Snow Valley" in res[0]["content"]
