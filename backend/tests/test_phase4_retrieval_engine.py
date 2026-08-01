"""
test_phase4_retrieval_engine.py — Unit tests for Phase 4 Retrieval Engine
==========================================================================
Verifies independent per-destination-day retrieval, tag overlap scoring,
vector embedding similarity re-ranking, Top-N candidate selection, and LLM stitching constraints.
"""

import pytest

from src.models.itinerary_block import ItineraryBlock
from src.services.block_retrieval_engine_service import (
    calculate_tag_overlap_score,
    calculate_embedding_similarity,
    generate_theme_embedding,
    filter_and_rank_blocks,
    select_or_stitch_best_block,
    retrieve_itinerary_blocks_pipeline,
)


def test_tag_overlap_score():
    """Verify tag overlap ratio calculation."""
    assert calculate_tag_overlap_score(["family", "budget"], ["family", "budget"]) == 1.0
    assert calculate_tag_overlap_score(["family", "budget"], ["family", "luxury"]) == 0.5
    assert calculate_tag_overlap_score(["family"], ["adventure", "luxury"]) == 0.0


def test_embedding_similarity():
    """Verify Cosine similarity calculation between embedding vectors."""
    vec1 = [1.0, 0.0, 0.0, 0.0]
    vec2 = [1.0, 0.0, 0.0, 0.0]
    vec3 = [0.0, 1.0, 0.0, 0.0]

    assert calculate_embedding_similarity(vec1, vec2) == 1.0
    assert calculate_embedding_similarity(vec1, vec3) == 0.0


def test_filter_and_rank_blocks():
    """Verify filtering blocks by destination and re-ranking by tag overlap & embedding similarity."""
    pool = [
        ItineraryBlock(
            block_id="shillong_family_001",
            destination="Shillong",
            region="Meghalaya",
            duration_type="1_day",
            theme_tags=["family", "budget"],
            attractions_sequence=["ward_lake", "police_bazaar"],
            confidence=0.90
        ),
        ItineraryBlock(
            block_id="shillong_adventure_001",
            destination="Shillong",
            region="Meghalaya",
            duration_type="1_day",
            theme_tags=["adventure", "trekking"],
            attractions_sequence=["laitlum_canyons"],
            confidence=0.85
        ),
        ItineraryBlock(
            block_id="manali_snow_001",
            destination="Manali",
            region="Himachal",
            duration_type="1_day",
            theme_tags=["snow", "adventure"],
            attractions_sequence=["solang_valley"],
            confidence=0.95
        )
    ]

    # Query for Shillong with family theme
    ranked = filter_and_rank_blocks("Shillong", 1, ["family", "budget"], pool, top_n=5)
    assert len(ranked) >= 2
    top_block, top_score = ranked[0]
    assert top_block.block_id == "shillong_family_001"
    assert top_score > 0.70


@pytest.mark.anyio
async def test_select_or_stitch_best_block():
    """Verify Top-1 block direct selection when candidate score >= 0.70."""
    candidate = ItineraryBlock(
        block_id="cherrapunji_nature_001",
        destination="Cherrapunji",
        region="Meghalaya",
        duration_type="1_day",
        theme_tags=["nature", "waterfalls"],
        attractions_sequence=["nohkalikai_falls", "mawsmai_caves"],
        confidence=0.95
    )

    top_candidates = [(candidate, 0.92)]
    result = await select_or_stitch_best_block("Cherrapunji", 1, top_candidates, ["nature"])

    assert result["destination"] == "Cherrapunji"
    assert result["selected_block_id"] == "cherrapunji_nature_001"
    assert "nohkalikai_falls" in result["attractions_sequence"]
    assert result["stitched"] is False


@pytest.mark.anyio
async def test_retrieve_itinerary_blocks_pipeline():
    """Verify multi-destination independent retrieval pipeline."""
    days_per_dest = {
        "Shillong": 1,
        "Cherrapunji": 1,
        "Dawki": 1
    }
    themes = ["family", "nature"]

    retrieved = await retrieve_itinerary_blocks_pipeline(days_per_dest, themes)
    assert len(retrieved) == 3

    assert retrieved[0]["destination"] == "Shillong"
    assert retrieved[1]["destination"] == "Cherrapunji"
    assert retrieved[2]["destination"] == "Dawki"

    for idx, day in enumerate(retrieved, start=1):
        assert day["day_number"] == idx
        assert len(day["attractions_sequence"]) > 0
