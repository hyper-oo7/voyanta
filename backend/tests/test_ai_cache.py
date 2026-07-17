import json
import pytest
from unittest.mock import MagicMock, patch
from src.services.ai_cache_service import (
    compute_cache_key,
    get_cached_extraction,
    save_cached_extraction,
    get_cache_stats,
    invalidate_cache,
)
from src.services.ai_service import call_gemini_with_retry, call_openai_with_retry

@pytest.mark.anyio
async def test_compute_cache_key_deterministic():
    agency_id = "agency-uuid-1"
    model = "gemini-2.5-flash"
    prompt_version = "v1.0"
    schema_version = "v2.0"
    normalized_input = "Delhi tour itinerary text"
    
    key1, hash1 = compute_cache_key(agency_id, model, prompt_version, schema_version, normalized_input)
    key2, hash2 = compute_cache_key(agency_id, model, prompt_version, schema_version, normalized_input)
    
    assert key1 == key2
    assert hash1 == hash2
    
    # Change agency ID -> platform-wide cache key remains identical
    key3, hash3 = compute_cache_key("agency-uuid-2", model, prompt_version, schema_version, normalized_input)
    assert key1 == key3
    assert hash1 == hash3  # input hash remains the same

@pytest.mark.anyio
async def test_get_and_save_cache():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    
    # Mock lookup
    mock_query = MagicMock()
    mock_table.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    
    mock_cache_record = {
        "cache_key": "dummy_key",
        "output_json": {"destination": "Agra", "total_price": 300}
    }
    mock_query.maybeSingle.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=mock_cache_record)
    
    with patch("src.services.ai_cache_service.get_supabase_client", return_value=mock_sb), \
         patch("src.services.ai_cache_service.increment_hits") as mock_hits:
        res = await get_cached_extraction("agency-1", "gemini-2.5-flash", "v1.0", "v1.0", "input text")
        assert res is not None
        assert res["destination"] == "Agra"
        mock_hits.assert_called_once()

@pytest.mark.anyio
async def test_cache_miss_and_stats():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    
    # Mock lookup to return None (cache miss)
    mock_query = MagicMock()
    mock_table.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.maybeSingle.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=None)
    
    with patch("src.services.ai_cache_service.get_supabase_client", return_value=mock_sb), \
         patch("src.services.ai_cache_service.increment_misses") as mock_misses:
        res = await get_cached_extraction("agency-1", "gemini-2.5-flash", "v1.0", "v1.0", "input text")
        assert res is None
        mock_misses.assert_called_once()

@pytest.mark.anyio
async def test_call_gemini_with_cache_hit():
    payload = {
        "contents": [{"parts": [{"text": "original prompt text"}]}],
        "_cache_meta": {
            "agency_id": "agency-123",
            "entity_type": "itinerary",
            "prompt_version": "v1",
            "schema_version": "v1",
            "model": "gemini-2.5-flash",
            "input_text": "Delhi Tour"
        }
    }
    
    mock_cached_output = {"success": True, "data": "Delhi Tour itinerary cached"}
    
    with patch("src.services.ai_cache_service.get_cached_extraction", return_value=mock_cached_output) as mock_get, \
         patch("src.services.ai_client._post_http_call") as mock_raw, \
         patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        res = await call_gemini_with_retry(payload, "fake_api_key")
        
        # Ensure raw LLM call is NOT made
        mock_raw.assert_not_called()
        
        # Ensure caching lookup was called
        mock_get.assert_called_once_with("agency-123", "gemini-2.5-flash", "v1", "v1", "Delhi Tour")
        
        # Validate returned structure mimics Gemini API format
        content_text = res["candidates"][0]["content"]["parts"][0]["text"]
        assert json.loads(content_text) == mock_cached_output

@pytest.mark.anyio
async def test_call_gemini_with_cache_miss_and_save():
    payload = {
        "contents": [{"parts": [{"text": "original prompt text"}]}],
        "_cache_meta": {
            "agency_id": "agency-123",
            "entity_type": "itinerary",
            "prompt_version": "v1",
            "schema_version": "v1",
            "model": "gemini-2.5-flash",
            "input_text": "Delhi Tour"
        }
    }
    
    mock_live_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": '{"success": true, "data": "live response"}'}
                    ]
                }
            }
        ]
    }
    
    with patch("src.services.ai_cache_service.get_cached_extraction", return_value=None) as mock_get, \
         patch("src.services.ai_client._post_http_call", return_value=mock_live_response) as mock_raw, \
         patch("src.services.ai_cache_service.save_cached_extraction") as mock_save, \
         patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        res = await call_gemini_with_retry(payload, "fake_api_key")
        
        # Raw LLM call should be made
        mock_raw.assert_called_once()
        
        # Caching lookup should be made
        mock_get.assert_called_once()
        
        # Save cache should be triggered
        mock_save.assert_called_once_with(
            agency_id="agency-123",
            entity_type="itinerary",
            entity_id=None,
            model="gemini-2.5-flash",
            prompt_version="v1",
            schema_version="v1",
            normalized_input="Delhi Tour",
            output_json={"success": True, "data": "live response"}
        )
        
        assert res == mock_live_response
