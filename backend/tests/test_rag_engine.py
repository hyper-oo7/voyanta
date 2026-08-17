import pytest
from unittest.mock import MagicMock, patch
from src.services.rag_engine import rag_engine

@pytest.mark.anyio
async def test_retrieve_async_and_parallel():
    mock_chunks = [
        {"content": "Hotel Snow Valley in Manali", "similarity": 0.85, "metadata": {"section_title": "Hotels"}},
        {"content": "Solang Valley adventure activities", "similarity": 0.78, "metadata": {"section_title": "Activities"}},
    ]

    with patch("src.services.embedder.embedder.embed_query", return_value=[0.1] * 768), \
         patch("src.services.vector_store.vector_store.search", return_value=mock_chunks):
        
        # Test retrieve_async
        res = await rag_engine.retrieve_async("agency-123", "Manali hotels", destination="Manali", k=5)
        assert len(res) == 2
        assert res[0]["content"] == "Hotel Snow Valley in Manali"

        # Test run_rag_by_type_parallel
        parallel_res = await rag_engine.run_rag_by_type_parallel("agency-123", "Manali", duration_days=5)
        assert parallel_res["chunk_count"] == 2
        assert "context" in parallel_res
        assert "Hotel Snow Valley" in parallel_res["context"]

def test_rerank_chunks():
    chunks = [
        {"content": "Low relevance chunk", "similarity": 0.5},
        {"content": "High relevance luxury hotel in Srinagar", "similarity": 0.6},
    ]

    with patch("src.services.embedder.embedder.embed_query", return_value=[1.0, 0.0]), \
         patch("src.services.embedder.embedder.embed_text", side_effect=[[0.0, 1.0], [1.0, 0.0]]):
        reranked = rag_engine.rerank_chunks(chunks, "luxury hotel in Srinagar", top_k=2)
        assert len(reranked) == 2
        # Second chunk should be ranked first due to higher dot product (1.0 vs 0.0)
        assert "High relevance" in reranked[0]["content"]

@pytest.mark.anyio
async def test_retrieve_with_hyde():
    mock_chunks = [
        {"content": "HyDE matched hotel in Manali", "similarity": 0.92, "metadata": {"section_title": "Hotels"}},
    ]

    with patch("src.services.ai_client.call_llm", return_value="Hotel package with 4-star boutique stay in Manali"), \
         patch("src.services.embedder.embedder.embed_query", return_value=[0.1] * 768), \
         patch("src.services.vector_store.vector_store.search", return_value=mock_chunks):
        res = await rag_engine.retrieve_with_hyde(
            agency_id="agency-123",
            destination="Manali",
            duration_days=4,
            budget_inr=30000,
        )
        assert len(res) == 1
        assert "HyDE matched" in res[0]["content"]

def test_format_context_sentence_window():
    chunks = [
        {
            "content": "Day 1: Arrival in Srinagar.",
            "metadata": {
                "document_name": "kashmir_pkg.pdf",
                "section_title": "Day 1",
                "chunk_type": "itinerary_day",
                "context_window": "Welcome to Kashmir! Day 1: Arrival in Srinagar. Transfer to Dal Lake houseboat."
            }
        },
        {
            "content": "Day 2: Gulmarg excursion.",
            "metadata": {
                "document_name": "kashmir_pkg.pdf",
                "section_title": "Day 2",
                "chunk_type": "itinerary_day",
            }
        }
    ]
    formatted = rag_engine.format_context(chunks)
    # First chunk should use expanded context_window
    assert "Transfer to Dal Lake houseboat" in formatted
    # Second chunk should use standard content as fallback
    assert "Day 2: Gulmarg excursion" in formatted

@pytest.mark.anyio
async def test_rerank_chunks_llm():
    chunks = [
        {"content": "Budget homestay in outskirts", "similarity": 0.7},
        {"content": "5-star luxury resort with pool and breakfast", "similarity": 0.6},
    ]

    # Test LLM scoring path
    with patch("src.services.ai_client.call_llm", return_value="2, 9"):
        reranked = await rag_engine.rerank_chunks_llm(chunks, "luxury 5-star resort", top_k=2)
        assert len(reranked) == 2
        assert "5-star luxury" in reranked[0]["content"]
        assert reranked[0]["llm_rerank_score"] == 9

    # Test fallback path when LLM scoring returns malformed output
    with patch("src.services.ai_client.call_llm", return_value="invalid response"), \
         patch("src.services.embedder.embedder.embed_query", return_value=[1.0, 0.0]), \
         patch("src.services.embedder.embedder.embed_text", side_effect=[[0.0, 1.0], [1.0, 0.0]]):
        reranked_fallback = await rag_engine.rerank_chunks_llm(chunks, "luxury 5-star resort", top_k=2)
        assert len(reranked_fallback) == 2

@pytest.mark.anyio
async def test_retrieve_hierarchical_async():
    mock_chunks = [
        {"content": "Off-topic chunk from doc 99", "document_id": "doc-99", "similarity": 0.9},
        {"content": "Relevant Kashmir houseboat chunk", "document_id": "doc-1", "similarity": 0.85},
    ]

    with patch("src.services.embedder.embedder.embed_query", return_value=[0.1] * 768), \
         patch("src.services.vector_store.vector_store.search_by_document_scope", return_value=["doc-1"]), \
         patch("src.services.vector_store.vector_store.search", return_value=mock_chunks):
        res = await rag_engine.retrieve_hierarchical_async(
            agency_id="agency-123",
            query="Kashmir Dal lake houseboat",
            destination="Kashmir",
            top_docs=1,
            k=2,
        )
        assert len(res) == 2
        # Document doc-1 should be prioritized due to hierarchical scope matching
        assert res[0]["document_id"] == "doc-1"
        assert "houseboat" in res[0]["content"]

