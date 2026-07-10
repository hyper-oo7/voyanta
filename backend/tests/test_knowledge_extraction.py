import pytest
import os
import json
from unittest.mock import MagicMock, patch
from src.services.knowledge_extraction_service import extract_knowledge_objects, save_knowledge_objects

@pytest.mark.anyio
async def test_extract_knowledge_objects_success():
    # Mock LLM response containing a JSON array of parsed atomic entities and tags
    mock_llm_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps([
                                {
                                    "object_type": "hotel",
                                    "name": "Atlantis The Palm",
                                    "destination": "Dubai",
                                    "area": "Palm Jumeirah",
                                    "attributes": {"star_rating": 5, "price_per_night": 450},
                                    "tags": [
                                        {"tag_category": "audience", "tag": "couple"},
                                        {"tag_category": "price_tier", "tag": "luxury"}
                                    ]
                                },
                                {
                                    "object_type": "activity",
                                    "name": "Desert Safari with BBQ Dinner",
                                    "destination": "Dubai",
                                    "area": "Lahbab Desert",
                                    "attributes": {"duration": "6 hours", "price": 65},
                                    "tags": [
                                        {"tag_category": "pace", "tag": "moderate"},
                                        {"tag_category": "duration", "tag": "half-day"}
                                    ]
                                }
                            ])
                        }
                    ]
                }
            }
        ]
    }

    with patch("src.services.knowledge_extraction_service.call_gemini_with_retry", return_value=mock_llm_response):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy-key"}):
            entities = await extract_knowledge_objects("Atlantis Palm hotel Dubai...")
            
            assert len(entities) == 2
            assert entities[0]["object_type"] == "hotel"
            assert len(entities[0]["tags"]) == 2
            assert entities[0]["tags"][0]["tag_category"] == "audience"
            assert entities[0]["tags"][0]["tag"] == "couple"

def test_save_knowledge_objects_database_inserts_and_tags():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.upsert.return_value = mock_table
    
    # Mock database return value for insert
    mock_records = [
        {"id": "uuid-1", "name": "Atlantis The Palm", "object_type": "hotel"},
        {"id": "uuid-2", "name": "Desert Safari", "object_type": "activity"}
    ]
    mock_table.execute.return_value = MagicMock(data=mock_records)

    with patch("src.services.knowledge_extraction_service.get_supabase_client", return_value=mock_sb):
        entities = [
            {
                "object_type": "hotel",
                "name": "Atlantis The Palm",
                "destination": "Dubai",
                "attributes": {},
                "tags": [
                    {"tag_category": "audience", "tag": "couple"},      # Valid
                    {"tag_category": "price_tier", "tag": "luxury"},    # Valid
                    {"tag_category": "invalid_cat", "tag": "luxury"},   # Invalid - category not in taxonomy
                    {"tag_category": "audience", "tag": "super-couple"} # Invalid - tag not in taxonomy
                ]
            },
            {
                "object_type": "activity",
                "name": "Desert Safari",
                "destination": "Dubai",
                "attributes": {},
                "tags": [
                    {"tag_category": "pace", "tag": "moderate"},         # Valid
                    {"tag_category": "duration", "tag": "half-day-ex"}  # Invalid - tag value not in taxonomy
                ]
            }
        ]
        
        count = save_knowledge_objects(
            objects=entities,
            agency_id="agency-uuid-1234",
            source_pdf_id="pdf-uuid-5678"
        )
        
        assert count == 2
        mock_sb.table.assert_any_call("knowledge_objects")
        
        # Verify call to upsert tags on object_tags table
        mock_sb.table.assert_any_call("object_tags")
        tag_upsert_payload = mock_table.upsert.call_args[0][0]
        
        # Check that only 3 valid tags are prepared for insertion
        assert len(tag_upsert_payload) == 3
        
        # Atlantis tags
        assert tag_upsert_payload[0]["object_id"] == "uuid-1"
        assert tag_upsert_payload[0]["tag_category"] == "audience"
        assert tag_upsert_payload[0]["tag"] == "couple"
        
        assert tag_upsert_payload[1]["object_id"] == "uuid-1"
        assert tag_upsert_payload[1]["tag_category"] == "price_tier"
        assert tag_upsert_payload[1]["tag"] == "luxury"
        
        # Desert safari tags
        assert tag_upsert_payload[2]["object_id"] == "uuid-2"
        assert tag_upsert_payload[2]["tag_category"] == "pace"
        assert tag_upsert_payload[2]["tag"] == "moderate"

@pytest.mark.anyio
async def test_get_knowledge_objects_with_tag_filters():
    from src.api.routers.knowledge_router import get_knowledge_objects
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.range.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.or_.return_value = mock_table
    
    # Mock tags filter query (object_tags table) returning 1 matched object_id
    mock_tags_return = [{
        "object_id": "uuid-matched-123",
        "tag_category": "audience",
        "tag": "couple"
    }]
    # Mock main table objects returning 1 record
    mock_objs_return = [{
        "id": "uuid-matched-123",
        "name": "Luxury Hotel",
        "object_type": "hotel",
        "destination": "Dubai"
    }]
    
    # Configure execute return values properly with real attributes
    mock_tags_res = MagicMock()
    mock_tags_res.data = mock_tags_return
    mock_tags_res.count = 1
    
    mock_objs_res = MagicMock()
    mock_objs_res.data = mock_objs_return
    mock_objs_res.count = 1

    # We will configure a side effect for execute() based on what was selected
    def execute_side_effect():
        select_calls = mock_table.select.call_args_list
        if select_calls:
            last_select_arg = select_calls[-1][0][0]
            if "*" in str(last_select_arg):
                return mock_objs_res
        return mock_tags_res
        
    mock_table.execute.side_effect = execute_side_effect
    
    with patch("src.api.routers.knowledge_router.get_supabase_client", return_value=mock_sb):
        res = await get_knowledge_objects(
            audience="couple",
            price_tier="luxury",
            page=1,
            page_size=20,
            user={"agency_id": "agency-123"}
        )
        
        import json
        body = json.loads(res.body)
        assert res.status_code == 200
        assert body["status"] == "success"
        assert len(body["data"]) == 1
        assert body["data"][0]["name"] == "Luxury Hotel"
        
        # Verify both table lookups were performed
        mock_sb.table.assert_any_call("object_tags")
        mock_sb.table.assert_any_call("knowledge_objects")


@pytest.mark.anyio
async def test_get_proposal_suggestions_ranking():
    from src.api.routers.knowledge_router import get_proposal_suggestions
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.or_.return_value = mock_table
    mock_table.ilike.return_value = mock_table
    
    # 1. Mock proposals table query
    mock_proposal = [{
        "id": "prop-123",
        "destination": "Dubai",
        "brief": {
            "num_adults": 2,
            "num_children": 1,
            "budget": 10000.0  # luxury
        }
    }]
    
    # 2. Mock knowledge_objects table query
    mock_objects = [
        {"id": "hotel-1", "name": "Hotel Luxury Family", "object_type": "hotel", "destination": "Dubai"},
        {"id": "hotel-2", "name": "Hotel Budget Couples", "object_type": "hotel", "destination": "Dubai"}
    ]
    
    # 3. Mock object_tags table query
    mock_tags = [
        {"object_id": "hotel-1", "tag_category": "audience", "tag": "family"},
        {"object_id": "hotel-1", "tag_category": "price_tier", "tag": "luxury"},
        {"object_id": "hotel-2", "tag_category": "audience", "tag": "couple"},
        {"object_id": "hotel-2", "tag_category": "price_tier", "tag": "budget"}
    ]
    
    # Setup execute() mock side-effect
    mock_proposal_res = MagicMock()
    mock_proposal_res.data = mock_proposal
    
    mock_objs_res = MagicMock()
    mock_objs_res.data = mock_objects
    
    mock_tags_res = MagicMock()
    mock_tags_res.data = mock_tags
    
    def execute_side_effect():
        called_table = mock_sb.table.call_args[0][0]
        if called_table == "proposals":
            return mock_proposal_res
        elif called_table == "knowledge_objects":
            return mock_objs_res
        elif called_table == "object_tags":
            return mock_tags_res
        return MagicMock(data=[])
        
    mock_table.execute.side_effect = execute_side_effect
    
    with patch("src.api.routers.knowledge_router.get_supabase_client", return_value=mock_sb):
        res = await get_proposal_suggestions(
            proposal_id="prop-123",
            step="hotels",
            user={"agency_id": "agency-123"}
        )
        
        import json
        body = json.loads(res.body)
        assert res.status_code == 200
        assert body["status"] == "success"
        
        # Verify ranking: hotel-1 should be ranked first (score 4.0) and hotel-2 second (score 0.0)
        suggestions = body["suggestions"]
        assert len(suggestions) == 2
        assert suggestions[0]["id"] == "hotel-1"
        assert suggestions[0]["score"] == 4.0
        assert "family" in suggestions[0]["matched_tags"]
        assert "luxury" in suggestions[0]["matched_tags"]
        
        assert suggestions[1]["id"] == "hotel-2"
        assert suggestions[1]["score"] == 0.0


@pytest.mark.anyio
async def test_save_knowledge_objects_supplier_rates():
    from src.services.knowledge_extraction_service import save_knowledge_objects
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.upsert.return_value = mock_table
    
    # Mock return value of inserting knowledge objects
    mock_inserted_objs = [{"id": "obj-123", "name": "Plaza Hotel", "object_type": "hotel"}]
    mock_res = MagicMock()
    mock_res.data = mock_inserted_objs
    mock_table.execute.return_value = mock_res
    
    # Capture inserted rates
    inserted_rates = []
    def insert_side_effect(data):
        nonlocal inserted_rates
        if isinstance(data, list) and len(data) > 0 and "supplier_name" in data[0]:
            inserted_rates = data
        return mock_table
        
    mock_table.insert.side_effect = insert_side_effect
    
    # Input object with a rate
    objects = [{
        "name": "Plaza Hotel",
        "object_type": "hotel",
        "destination": "New York",
        "rates": [{
            "supplier_name": "TBO Holidays",
            "rate": 150.0,
            "currency": "USD",
            "valid_from": "2026-01-01",
            "valid_to": "2026-12-31"
        }]
    }]
    
    with patch("src.services.knowledge_extraction_service.get_supabase_client", return_value=mock_sb):
        count = save_knowledge_objects(objects, agency_id="agency-123", source_pdf_id="pdf-123")
        assert count == 1
        
        # Verify supplier rate was inserted correctly
        assert len(inserted_rates) == 1
        rate = inserted_rates[0]
        assert rate["knowledge_object_id"] == "obj-123"
        assert rate["supplier_name"] == "TBO Holidays"
        assert rate["rate"] == 150.0
        assert rate["currency"] == "USD"
        assert rate["valid_from"] == "2026-01-01"
        assert rate["valid_to"] == "2026-12-31"
        assert rate["agency_id"] == "agency-123"
        assert rate["source_pdf_id"] == "pdf-123"


@pytest.mark.anyio
async def test_get_best_rate_date_filtering():
    from src.api.routers.knowledge_router import get_best_rate
    from datetime import date, timedelta
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.or_.return_value = mock_table
    
    today_str = date.today().isoformat()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
    
    # Mock database rates:
    # 1. TBO: 150 (valid from yesterday to tomorrow) -> VALID
    # 2. Desiya: 100 (valid starting tomorrow) -> INVALID
    # 3. GTA: 200 (valid from yesterday to tomorrow) -> VALID
    mock_rates = [
        {"id": "r1", "supplier_name": "TBO", "rate": 150.0, "currency": "INR", "valid_from": yesterday_str, "valid_to": tomorrow_str},
        {"id": "r2", "supplier_name": "Desiya", "rate": 100.0, "currency": "INR", "valid_from": tomorrow_str, "valid_to": None},
        {"id": "r3", "supplier_name": "GTA", "rate": 200.0, "currency": "INR", "valid_from": yesterday_str, "valid_to": tomorrow_str}
    ]
    
    mock_res = MagicMock()
    mock_res.data = mock_rates
    mock_table.execute.return_value = mock_res
    
    with patch("src.api.routers.knowledge_router.get_supabase_client", return_value=mock_sb):
        res = await get_best_rate(obj_id="obj-123", user={"agency_id": "agency-123"})
        
        import json
        body = json.loads(res.body)
        assert res.status_code == 200
        assert body["status"] == "success"
        
        best = body["best_rate"]
        assert best is not None
        assert best["supplier_name"] == "TBO"
        assert best["rate"] == 150.0



@pytest.mark.anyio
async def test_affinity_aggregation_and_scoring():
    from src.services.affinity_aggregation_service import aggregate_affinity
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.in_.return_value = mock_table
    
    # Mock activity logs returned
    mock_logs = [
        # hotel-1: 2 shown, 1 added, 1 rejected -> suggested=2, added=1, rejected=1
        {"agency_id": "agency-1", "entity_id": "hotel-1", "action": "suggestion_shown"},
        {"agency_id": "agency-1", "entity_id": "hotel-1", "action": "suggestion_shown"},
        {"agency_id": "agency-1", "entity_id": "hotel-1", "action": "suggestion_added"},
        {"agency_id": "agency-1", "entity_id": "hotel-1", "action": "suggestion_rejected"},
        # hotel-2: 1 shown, 0 added, 1 explicitly rejected (deleted) -> suggested=1, added=0, rejected=1
        {"agency_id": "agency-1", "entity_id": "hotel-2", "action": "suggestion_shown"},
        {"agency_id": "agency-1", "entity_id": "hotel-2", "action": "item_deleted_after_add"}
    ]
    
    mock_logs_res = MagicMock()
    mock_logs_res.data = mock_logs
    mock_table.execute.return_value = mock_logs_res
    
    # We will capture upsert calls
    upsert_calls = []
    def upsert_side_effect(data):
        upsert_calls.append(data)
        return MagicMock()
        
    mock_table.upsert.side_effect = upsert_side_effect
    
    with patch("src.services.affinity_aggregation_service.get_supabase_client", return_value=mock_sb):
        ok = aggregate_affinity()
        assert ok is True
        
        # We expect 2 unique agency_id + object_id pairs
        assert len(upsert_calls) == 2
        
        # Verify hotel-1 metrics and score
        # score = (1 * 1.5) - (1 * 3.0) = -1.5
        h1_data = next(u for u in upsert_calls if u["object_id"] == "hotel-1")
        assert h1_data["times_suggested"] == 2
        assert h1_data["times_added"] == 1
        assert h1_data["times_rejected"] == 1
        assert h1_data["affinity_score"] == -1.5
        
        # Verify hotel-2 metrics and score
        # score = (0 * 1.5) - (1 * 3) = -3.0
        h2_data = next(u for u in upsert_calls if u["object_id"] == "hotel-2")
        assert h2_data["times_suggested"] == 1
        assert h2_data["times_added"] == 0
        assert h2_data["times_rejected"] == 1
        assert h2_data["affinity_score"] == -3.0


@pytest.mark.anyio
async def test_get_seasonal_rules_endpoint():
    from src.api.routers.knowledge_router import get_seasonal_rules
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.ilike.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.or_.return_value = mock_table
    
    mock_rules = [
        {"id": "r1", "destination": "Goa", "month": 6, "rule_type": "avoid", "applies_to_tag": "outdoor", "message": "Monsoon in Goa"}
    ]
    mock_res = MagicMock()
    mock_res.data = mock_rules
    mock_table.execute.return_value = mock_res
    
    with patch("src.api.routers.knowledge_router.get_supabase_client", return_value=mock_sb):
        res = await get_seasonal_rules(destination="Goa", month=6, user={"agency_id": "agency-1"})
        
        import json
        body = json.loads(res.body)
        assert res.status_code == 200
        assert body["status"] == "success"
        assert len(body["rules"]) == 1
        assert body["rules"][0]["rule_type"] == "avoid"


@pytest.mark.anyio
async def test_save_knowledge_objects_seasonal_rule():
    from src.services.knowledge_extraction_service import save_knowledge_objects
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])
    
    # Capture rules inserted
    inserted_rules = []
    def insert_side_effect(data):
        nonlocal inserted_rules
        if isinstance(data, dict) and "rule_type" in data:
            inserted_rules.append(data)
        return MagicMock()
    mock_table.insert.side_effect = insert_side_effect
    
    # Input list containing seasonal rules
    objects = [
        {
            "object_type": "seasonal_rule",
            "name": "Dubai Hot Summer Warning",
            "destination": "Dubai",
            "attributes": {
                "month": 7,
                "rule_type": "avoid",
                "applies_to_tag": "outdoor",
                "message": "Extremely hot in July"
            }
        }
    ]
    
    with patch("src.services.knowledge_extraction_service.get_supabase_client", return_value=mock_sb):
        count = save_knowledge_objects(objects, agency_id="agency-1", source_pdf_id="pdf-1")
        # Should be 0 since it is routed to seasonal_rules instead of knowledge_objects
        assert count == 0
        
        # Verify seasonal rule is stored correctly
        assert len(inserted_rules) == 1
        rule = inserted_rules[0]
        assert rule["destination"] == "Dubai"
        assert rule["month"] == 7
        assert rule["rule_type"] == "avoid"
        assert rule["applies_to_tag"] == "outdoor"
        assert rule["message"] == "Extremely hot in July"
        assert rule["agency_id"] == "agency-1"
        assert rule["source_pdf_id"] == "pdf-1"




