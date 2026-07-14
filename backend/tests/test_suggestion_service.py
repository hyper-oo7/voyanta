import pytest
from src.services.suggestion_service import infer_proposal_criteria, score_candidates, get_proposal_suggestions_service
from unittest.mock import MagicMock, AsyncMock, patch

def test_infer_proposal_criteria_luxury():
    proposal_data = {
        "name": "Luxury Honeymoon in Paris",
        "travelers": 2,
        "start_date": "2026-07-14Z",
        "brief": {
            "destination": "Paris",
            "budget": 10000,
            "notes": "Honeymoon anniversary trip"
        }
    }
    criteria = infer_proposal_criteria(proposal_data)
    assert criteria["destination"] == "Paris"
    assert criteria["price_tier"] == "luxury"
    assert "couple" in criteria["audience_tags"] or "honeymoon" in criteria["audience_tags"]
    assert criteria["travel_month"] == 7

def test_infer_proposal_criteria_budget_family():
    proposal_data = {
        "name": "Budget Family Outing",
        "brief": {
            "destination": "Goa",
            "budget": 1500,
            "num_children": 2,
            "notes": "Fun family trip"
        }
    }
    criteria = infer_proposal_criteria(proposal_data)
    assert criteria["destination"] == "Goa"
    assert criteria["price_tier"] == "budget"
    assert "family" in criteria["audience_tags"] or "kids" in criteria["audience_tags"]

def test_score_candidates():
    objs = [
        {"id": "obj-1", "name": "Budget Stay", "object_type": "hotel", "destination": "Paris"},
        {"id": "obj-2", "name": "Luxury Villa", "object_type": "hotel", "destination": "Paris"},
        {"id": "obj-3", "name": "Disliked Stay", "object_type": "hotel", "destination": "Paris"},
        {"id": "obj-4", "name": "Low Affinity Stay", "object_type": "hotel", "destination": "Paris"}
    ]
    tags_data = [
        {"object_id": "obj-1", "tag": "budget", "tag_category": "price"},
        {"object_id": "obj-2", "tag": "luxury", "tag_category": "price"},
        {"object_id": "obj-2", "tag": "honeymoon", "tag_category": "audience"},
        {"object_id": "obj-3", "tag": "noisy", "tag_category": "vibe"},
        {"object_id": "obj-4", "tag": "budget", "tag_category": "price"}
    ]
    affinity_data = [
        {"object_id": "obj-4", "affinity_score": -6.0}
    ]
    seasonal_rules = [
        {"month": 7, "rule_type": "prefer", "applies_to_tag": "luxury"}
    ]
    
    target_tags = {"luxury", "honeymoon"}
    dislikes_set = {"noisy"}
    
    ranked = score_candidates(
        objs=objs,
        tags_data=tags_data,
        affinity_data=affinity_data,
        seasonal_rules=seasonal_rules,
        target_tags=target_tags,
        dislikes_set=dislikes_set
    )
    
    # obj-4 has affinity -6.0 (< -5.0) -> Excluded
    # obj-3 is tagged with "noisy" (in dislikes_set) -> Excluded
    assert len(ranked) == 2
    
    # obj-2 matched "luxury" and "honeymoon" (2 target tags * 2.0 = 4.0) + seasonal rules boost (+5.0) = 9.0
    # obj-1 matched 0 target tags -> score 0.0
    assert ranked[0]["id"] == "obj-2"
    assert ranked[0]["score"] == 9.0
    assert ranked[1]["id"] == "obj-1"
    assert ranked[1]["score"] == 0.0

@pytest.mark.anyio
async def test_get_proposal_suggestions_service():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    
    mock_query = MagicMock()
    mock_table.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.ilike.return_value = mock_query
    mock_query.or_.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.is_.return_value = mock_query
    
    # Mocking returns
    mock_execute = MagicMock()
    mock_query.execute.return_value = mock_execute
    
    # We will patch the tables sequentially using side_effect on mock_table.select or mock_sb.table
    # Side effects to match table queries:
    # 1. proposals -> eq("id", "proposal-1")
    # 2. clients -> eq("id", "client-1")
    # 3. seasonal_rules -> ilike("destination", "%Paris%").eq("month", 7)
    # 4. knowledge_objects -> eq("object_type", "hotel")
    # 5. object_tags -> in_("object_id", ["obj-1"])
    # 6. object_affinity -> in_("object_id", ["obj-1"])
    # 7. proposal_items -> eq("proposal_id", "proposal-1")
    
    proposal_data = [{"id": "proposal-1", "client_id": "client-1", "destination": "Paris", "start_date": "2026-07-14Z"}]
    client_data = [{"id": "client-1", "preferences": {"dislikes": []}}]
    seasonal_data = []
    ko_data = [{"id": "obj-1", "name": "Mock Hotel", "object_type": "hotel", "destination": "Paris"}]
    tags_data = [{"object_id": "obj-1", "tag": "couple", "tag_category": "audience"}]
    aff_data = []
    items_data = []
    
    mock_execute.data = proposal_data
    
    # We'll use a patch for the database calls in a simpler way: mock execute output side_effects!
    mock_execute_side_effect = [
        MagicMock(data=proposal_data), # proposal
        MagicMock(data=client_data),   # client
        MagicMock(data=seasonal_data), # seasonal rules
        MagicMock(data=ko_data),       # knowledge objects
        MagicMock(data=tags_data),     # tags
        MagicMock(data=aff_data),      # affinity
        MagicMock(data=items_data)     # proposal items
    ]
    mock_query.execute.side_effect = mock_execute_side_effect
    
    res = await get_proposal_suggestions_service(mock_sb, "proposal-1", "hotels", None)
    assert res["status"] == "success"
    assert res["step"] == "hotels"
    assert len(res["suggestions"]) == 1
    assert res["suggestions"][0]["id"] == "obj-1"
