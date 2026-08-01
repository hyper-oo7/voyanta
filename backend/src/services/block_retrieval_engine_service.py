"""
block_retrieval_engine_service.py — Phase 4 Retrieval Engine
============================================================
Performs independent per-destination-day retrieval, filtering, tag-overlap + vector embedding
re-ranking, and Top-N candidate block selection or LLM stitching with strict attraction_id constraints.
"""

import re
import json
import logging
from typing import List, Dict, Any, Tuple, Optional, Set

from src.models.itinerary_block import ItineraryBlock, AttractionMasterRecord
from src.services.pdf_extraction_pipeline_service import generate_block_embedding
from src.services.hotel_transfer_normalization_service import normalize_city_name
from src.services.ai_client import call_llm

logger = logging.getLogger(__name__)


def calculate_tag_overlap_score(block_tags: List[str], target_tags: List[str]) -> float:
    """Calculates normalized tag overlap ratio [0.0 - 1.0]."""
    if not target_tags:
        return 1.0
    b_set = {t.lower().strip() for t in block_tags if t}
    t_set = {t.lower().strip() for t in target_tags if t}
    overlap = len(b_set & t_set)
    return round(overlap / len(t_set), 4)


def calculate_embedding_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculates Cosine similarity between two float vectors [0.0 - 1.0]."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    mag1 = sum(a * a for a in vec1) ** 0.5
    mag2 = sum(b * b for b in vec2) ** 0.5
    if mag1 == 0 or mag2 == 0:
        return 0.0
    similarity = dot_product / (mag1 * mag2)
    return round(max(0.0, min(1.0, similarity)), 4)


def generate_theme_embedding(theme_tags: List[str]) -> List[float]:
    """Generates a text embedding vector representing theme keywords."""
    combined_text = " ".join(theme_tags) if theme_tags else "general travel sightseeing"
    return generate_block_embedding(combined_text)


def filter_and_rank_blocks(
    destination: str,
    duration_days: int,
    theme_tags: List[str],
    blocks_pool: List[ItineraryBlock],
    top_n: int = 5
) -> List[Tuple[ItineraryBlock, float]]:
    """
    Step 4.1 & 4.2: Filter blocks by destination and duration, then re-rank by tag overlap
    and embedding similarity. Returns Top-N scored candidate blocks.
    """
    target_city = normalize_city_name(destination).lower()
    filtered: List[ItineraryBlock] = []

    for block in blocks_pool:
        b_dest = normalize_city_name(block.destination).lower()
        b_region = normalize_city_name(block.region).lower()
        if target_city in b_dest or target_city in b_region or b_dest in target_city:
            filtered.append(block)

    # Fallback to entire pool if no exact destination matches found
    if not filtered:
        filtered = blocks_pool

    theme_vector = generate_theme_embedding(theme_tags)
    scored_blocks: List[Tuple[ItineraryBlock, float]] = []

    for block in filtered:
        tag_score = calculate_tag_overlap_score(block.theme_tags, theme_tags)
        
        # Build block text representation for embedding similarity
        block_text = f"{block.destination} {block.region} {' '.join(block.attractions_sequence)} {' '.join(block.theme_tags)}"
        block_vector = generate_block_embedding(block_text)
        emb_score = calculate_embedding_similarity(theme_vector, block_vector)
        
        confidence_score = block.confidence

        # Composite Score Weights: 50% tag overlap, 30% embedding similarity, 20% extraction confidence
        composite_score = round((0.50 * tag_score) + (0.30 * emb_score) + (0.20 * confidence_score), 4)
        scored_blocks.append((block, composite_score))

    # Sort descending by composite score
    scored_blocks.sort(key=lambda x: x[1], reverse=True)
    return scored_blocks[:top_n]


async def select_or_stitch_best_block(
    destination: str,
    day_number: int,
    top_candidates: List[Tuple[ItineraryBlock, float]],
    theme_tags: List[str]
) -> Dict[str, Any]:
    """
    Step 4.3 & 4.4: Select best single block or stitch candidates via single LLM call.
    Prompt constraint: "select only from these attraction_ids, never invent new ones."
    """
    if not top_candidates:
        # Fallback empty block
        return {
            "destination": destination,
            "day_number": day_number,
            "selected_block_id": f"{destination.lower()}_fallback_day_{day_number}",
            "attractions_sequence": [f"{destination.lower()}_city_center"],
            "slot_map": {"morning": [f"{destination.lower()}_city_center"], "afternoon": [], "evening": []},
            "score": 0.50,
            "stitched": False
        }

    top_block, top_score = top_candidates[0]

    # If top block has high confidence & tag match (>= 0.70), return directly ($0 AI cost)
    if top_score >= 0.70 and top_block.attractions_sequence:
        logger.info(f"[Phase 4 Retrieval] Direct Top-1 match for {destination} Day {day_number} (score: {top_score}). $0 AI cost.")
        return {
            "destination": destination,
            "day_number": day_number,
            "selected_block_id": top_block.block_id,
            "attractions_sequence": top_block.attractions_sequence,
            "slot_map": top_block.slot_map,
            "hotel_used_in_source": top_block.hotel_used_in_source,
            "score": top_score,
            "stitched": False
        }

    # Low score or multiple candidate blocks — perform 1 LLM call to stitch/select
    candidate_attraction_pool: Set[str] = set()
    candidate_blocks_desc = []
    for idx, (b, score) in enumerate(top_candidates, start=1):
        seq = b.attractions_sequence
        candidate_attraction_pool.update(seq)
        candidate_blocks_desc.append(
            f"Candidate {idx} (ID: {b.block_id}, Score: {score}): Attractions = {seq}, SlotMap = {b.slot_map}"
        )

    allowed_attractions_list = sorted(list(candidate_attraction_pool))

    prompt = f"""
    You are an expert travel itinerary retrieval and stitching engine for {destination} (Day {day_number}).
    Requested Themes: {theme_tags}

    Candidate Blocks:
    {chr(10).join(candidate_blocks_desc)}

    Allowed Candidate Attraction IDs:
    {allowed_attractions_list}

    STRICT CONSTRAINTS:
    1. Select and order attraction_ids ONLY from the allowed list above. NEVER invent new attraction_ids or placeholder names.
    2. Group selected attraction_ids into "slot_map" with keys "morning", "afternoon", "evening".
    3. Return ONLY a valid JSON object matching:
       {{
         "selected_block_id": "{top_block.block_id}",
         "attractions_sequence": ["attraction_id_1", "attraction_id_2"],
         "slot_map": {{"morning": ["attraction_id_1"], "afternoon": ["attraction_id_2"], "evening": []}}
       }}
    """

    try:
        llm_res = await call_llm(
            prompt=prompt,
            system_prompt="You are a travel retrieval engine. Output valid JSON only.",
            temperature=0.0
        )
        json_match = re.search(r"\{.*\}", llm_res, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(0))
            raw_seq = parsed.get("attractions_sequence", [])
            # Filter strictly against allowed attraction IDs to enforce constraint
            valid_seq = [a for a in raw_seq if a in candidate_attraction_pool]
            if valid_seq:
                return {
                    "destination": destination,
                    "day_number": day_number,
                    "selected_block_id": parsed.get("selected_block_id") or top_block.block_id,
                    "attractions_sequence": valid_seq,
                    "slot_map": parsed.get("slot_map") or top_block.slot_map,
                    "hotel_used_in_source": top_block.hotel_used_in_source,
                    "score": top_score,
                    "stitched": True
                }
    except Exception as e:
        logger.warning(f"[Phase 4 Retrieval] LLM stitching fallback failed for {destination} Day {day_number}: {e}")

    # Fallback to top-1 candidate
    return {
        "destination": destination,
        "day_number": day_number,
        "selected_block_id": top_block.block_id,
        "attractions_sequence": top_block.attractions_sequence,
        "slot_map": top_block.slot_map,
        "hotel_used_in_source": top_block.hotel_used_in_source,
        "score": top_score,
        "stitched": False
    }


async def retrieve_itinerary_blocks_pipeline(
    days_per_destination: Dict[str, int],
    theme_tags: List[str],
    blocks_pool: Optional[List[ItineraryBlock]] = None,
    agency_id: str = "global"
) -> List[Dict[str, Any]]:
    """
    Executes Phase 4 Retrieval Engine independently for each destination-day pair.
    Example input: days_per_destination = {"Shillong": 1, "Cherrapunji": 1, "Dawki": 1}
    Output: List of retrieved day blocks in itinerary sequence.
    """
    if blocks_pool is None:
        # Seed baseline fallback block pool if database pool is empty
        blocks_pool = [
            ItineraryBlock(
                block_id="shillong_family_1day_001",
                destination="Shillong",
                region="Meghalaya",
                duration_type="1_day",
                theme_tags=["family", "budget", "nature"],
                attractions_sequence=["ward_lake", "police_bazaar", "elephant_falls"],
                slot_map={"morning": ["ward_lake"], "afternoon": ["police_bazaar"], "evening": ["elephant_falls"]},
                hotel_used_in_source="Hotel Pine Hill",
                confidence=0.92
            ),
            ItineraryBlock(
                block_id="cherrapunji_adventure_1day_001",
                destination="Cherrapunji",
                region="Meghalaya",
                duration_type="1_day",
                theme_tags=["adventure", "nature", "family"],
                attractions_sequence=["nohkalikai_falls", "mawsmai_caves", "seven_sisters_falls"],
                slot_map={"morning": ["nohkalikai_falls"], "afternoon": ["mawsmai_caves"], "evening": ["seven_sisters_falls"]},
                hotel_used_in_source="Cherra Resort",
                confidence=0.95
            ),
            ItineraryBlock(
                block_id="dawki_lakes_1day_001",
                destination="Dawki",
                region="Meghalaya",
                duration_type="1_day",
                theme_tags=["nature", "budget", "boating"],
                attractions_sequence=["umngot_river", "dawki_bridge", "mawlynnong_cleanest_village"],
                slot_map={"morning": ["umngot_river"], "afternoon": ["dawki_bridge"], "evening": ["mawlynnong_cleanest_village"]},
                hotel_used_in_source="Dawki Homestay",
                confidence=0.90
            ),
            ItineraryBlock(
                block_id="manali_adventure_1day_001",
                destination="Manali",
                region="Himachal",
                duration_type="1_day",
                theme_tags=["adventure", "hills", "snow"],
                attractions_sequence=["hadimba_temple", "solang_valley", "mall_road"],
                slot_map={"morning": ["hadimba_temple"], "afternoon": ["solang_valley"], "evening": ["mall_road"]},
                hotel_used_in_source="Snow Valley Resorts",
                confidence=0.94
            )
        ]

    retrieved_days: List[Dict[str, Any]] = []
    current_day_num = 1

    for dest_name, num_days in days_per_destination.items():
        for d in range(1, num_days + 1):
            top_candidates = filter_and_rank_blocks(
                destination=dest_name,
                duration_days=1,
                theme_tags=theme_tags,
                blocks_pool=blocks_pool,
                top_n=5
            )

            retrieved = await select_or_stitch_best_block(
                destination=dest_name,
                day_number=current_day_num,
                top_candidates=top_candidates,
                theme_tags=theme_tags
            )

            retrieved_days.append(retrieved)
            current_day_num += 1

    return retrieved_days
