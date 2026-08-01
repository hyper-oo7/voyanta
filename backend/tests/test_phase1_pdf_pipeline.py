"""
test_phase1_pdf_pipeline.py — Unit tests for Phase 1 PDF Extraction Pipeline
==============================================================================
Verifies PDF text extraction, Day & Destination segmentation, structured block output,
fuzzy attraction deduplication, enrichment, vector embedding generation, and pipeline execution.
"""

import pytest

from src.models.itinerary_block import ItineraryBlock, AttractionMasterRecord
from src.services.pdf_extraction_pipeline_service import (
    segment_raw_itinerary,
    structure_chunk_into_block,
    deduplicate_attraction,
    enrich_attraction_record,
    generate_block_embedding,
    process_pdf_vault_document,
    calculate_string_similarity,
)


@pytest.mark.anyio
async def test_segment_raw_itinerary_regex():
    """Verify regex-based multi-day itinerary segmentation."""
    sample_text = """
    Day 1: Arrival in Shillong & Ward's Lake Visit
    Arrive at Guwahati airport and transfer to Shillong. Visit Ward's Lake and Police Bazaar in the evening.
    Hotel: Hotel Pine Hill.

    Day 2: Elephant Falls & Cherrapunji Drive
    After breakfast, drive to Cherrapunji. Visit Elephant Falls, Nohkalikai Falls and Mawsmai Caves.
    Hotel: Cherra Resort.
    """

    chunks = await segment_raw_itinerary(sample_text, "test_shillong.pdf")
    assert len(chunks) == 2
    assert chunks[0]["day_number"] == 1
    assert "Ward's Lake" in chunks[0]["raw_text"]
    assert chunks[1]["day_number"] == 2
    assert "Elephant Falls" in chunks[1]["raw_text"]


@pytest.mark.anyio
async def test_structure_chunk_into_block():
    """Verify Day-chunk structuring into an ItineraryBlock model."""
    day_chunk = {
        "day_number": 1,
        "raw_text": "Day 1: Shillong Arrival. Visit Ward's Lake and Police Bazaar. Hotel Pine Hill."
    }

    block = await structure_chunk_into_block(day_chunk, "agency_pdf_001.pdf")
    assert isinstance(block, ItineraryBlock)
    assert block.duration_type == "1_day"
    assert block.source_pdf == "agency_pdf_001.pdf"
    assert block.confidence >= 0.5


def test_fuzzy_attraction_deduplication():
    """Verify high-similarity fuzzy deduplication and low-similarity review queue flagging."""
    existing = {
        "ward_lake": AttractionMasterRecord(
            attraction_id="ward_lake",
            name="Ward's Lake",
            city="Shillong",
            duration_minutes=60
        )
    }

    # High similarity test: "Ward Lake" vs "Ward's Lake"
    canonical_id, score, req_review = deduplicate_attraction("Ward Lake", "Shillong", existing)
    assert canonical_id == "ward_lake"
    assert score >= 0.85
    assert req_review is False

    # Low similarity test: "Unknown Falls Spot" vs "Ward's Lake"
    new_id, score_low, req_review_low = deduplicate_attraction("Unknown Falls Spot", "Shillong", existing)
    assert req_review_low is True
    assert score_low < 0.85


def test_attraction_record_enrichment():
    """Verify enrichment lookup populates attraction metadata."""
    enriched = enrich_attraction_record("elephant_falls", "Elephant Falls", "Shillong")
    assert isinstance(enriched, AttractionMasterRecord)
    assert enriched.attraction_id == "elephant_falls"
    assert enriched.city == "Shillong"
    assert enriched.duration_minutes == 60
    assert "nature" in enriched.tags


def test_block_embedding_generation():
    """Verify block text embedding returns a normalized 64-dimensional float vector."""
    text = "Day 1 in Shillong visiting Ward's Lake and Elephant Falls"
    vector = generate_block_embedding(text)
    assert len(vector) == 64
    assert all(isinstance(v, float) for v in vector)
    # Unit vector magnitude check
    mag = sum(v * v for v in vector) ** 0.5
    assert abs(mag - 1.0) < 0.01


@pytest.mark.anyio
async def test_process_pdf_vault_document():
    """Verify full end-to-end PDF vault document extraction pipeline."""
    sample_text = """
    Day 1: Shillong Sightseeing
    Visit Ward's Lake and Police Bazaar. Overnight at Hotel Pine Hill.

    Day 2: Elephant Falls
    Visit Elephant Falls and drive to Cherrapunji.
    """
    
    # Create simple PDF bytes in memory
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), sample_text)
    pdf_bytes = doc.write()
    doc.close()

    result = await process_pdf_vault_document(
        pdf_bytes=pdf_bytes,
        filename="sample_shillong_vault.pdf"
    )

    assert result["status"] == "success"
    assert result["day_chunks_count"] >= 1
    assert len(result["blocks"]) >= 1
    assert result["embeddings_count"] >= 1
    assert result["avg_confidence"] > 0.0
