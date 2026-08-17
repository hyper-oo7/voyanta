import pytest
from unittest.mock import MagicMock, patch
from src.services.chunker import TravelDocumentChunker
from src.services.embedder import Embedder
from src.services.vector_store import VectorStore

def test_travel_document_chunker_sentence_window():
    chunker = TravelDocumentChunker(chunk_size=100, overlap=20)
    sample_text = (
        "Day 1: Arrival in Manali. Check into your hotel.\n"
        "Take some rest after the long journey. Explore the local mall road in the evening.\n"
        "Enjoy dinner at the hotel. Overnight stay in Manali.\n\n"
        "Hotel Details:\n"
        "Snow Valley Resorts - 4 Star Luxury Resort.\n"
        "Inclusions: Breakfast and Dinner.\n\n"
        "Pricing:\n"
        "Standard Package: ₹25,000 per couple.\n"
        "Deluxe Package: ₹35,000 per couple."
    )
    metadata = {"document_name": "manali_trip.pdf", "agency_id": "agency-999"}
    chunks = chunker.chunk_text(sample_text, metadata)

    assert len(chunks) > 0
    # Verify each chunk has content and context_window in metadata
    for chunk in chunks:
        assert "content" in chunk
        assert "metadata" in chunk
        assert "context_window" in chunk["metadata"]
        assert len(chunk["metadata"]["context_window"]) >= len(chunk["content"])

def test_embedder_batch_embedding():
    embedder = Embedder()
    texts = [
        "Welcome to Kashmir travel itinerary.",
        "5-star hotel in Dal Lake Srinagar.",
        "Gulmarg gondola ride tickets included."
    ]

    # Test Gemini batch embedding path with sys.modules mock
    mock_genai = MagicMock()
    mock_batch_embeddings = [[0.1] * 768, [0.2] * 768, [0.3] * 768]
    mock_genai.embed_content.return_value = {"embedding": mock_batch_embeddings}

    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), \
         patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        results = embedder.embed_texts(texts)
        assert len(results) == 3
        assert len(results[0]) == 768

    # Test fallback to serial loop
    with patch.dict("os.environ", {}, clear=True), \
         patch.object(embedder, "embed_text", return_value=[0.5] * 768):
        fallback_results = embedder.embed_texts(texts)
        assert len(fallback_results) == 3
        assert fallback_results[0] == [0.5] * 768

def test_vector_store_document_summary():
    store = VectorStore()
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_update = MagicMock()
    mock_eq = MagicMock()

    mock_sb.table.return_value = mock_table
    mock_table.update.return_value = mock_update
    mock_update.eq.return_value = mock_eq

    with patch("src.services.vector_store.get_supabase", return_value=mock_sb):
        # Test store_document_summary
        store.store_document_summary(
            document_id="doc-123",
            agency_id="agency-456",
            summary_text="5 Days Kashmir Luxury Tour package with Srinagar houseboats",
            summary_embedding=[0.1] * 768,
        )
        mock_sb.table.assert_called_with("documents")
        mock_table.update.assert_called_once()

        # Test search_by_document_scope
        mock_sb.rpc.return_value.execute.return_value.data = [
            {"id": "doc-123", "similarity": 0.88},
            {"id": "doc-456", "similarity": 0.75}
        ]
        matched_ids = store.search_by_document_scope(
            query_embedding=[0.1] * 768,
            agency_id="agency-456",
            top_docs=2,
        )
        assert matched_ids == ["doc-123", "doc-456"]
