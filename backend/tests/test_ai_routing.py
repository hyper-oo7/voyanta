"""Tests for cascading AI routing in cascading_ai_service."""
import os
import pytest
from unittest.mock import patch, AsyncMock
from src.services.cascading_ai_service import route_model_cascading

@pytest.mark.anyio
@patch("src.services.ai_client.call_llm", new_callable=AsyncMock)
async def test_route_model_cascading_gemini_success(mock_call):
    mock_call.return_value = '{"destination": "Paris", "sub_destinations": ["Eiffel Tower"], "overview": "Verbatim intro", "duration_days": 3, "currency": "EUR", "total_price": 100000, "days": [], "inclusions": [], "exclusions": [], "extra_sections": {}}'
    
    with patch.dict(os.environ, {"GEMINI_API_KEY": "mock-gemini-key"}):
        res = await route_model_cascading(
            compressed_text="Simple luxury trip to Paris",
            images=[{"url": "http://img.com/1.jpg"}],
            destination="Paris",
            budget=100000.0,
            duration=3,
            currency="EUR"
        )
        assert res["success"] is True
        assert res["model_used"] == "gemini-2.5-flash (faithful-extraction)"
        assert res["detected_destination"] == "Paris"
        assert len(res["recommendations"]) == 1
        assert res["total_price"] == 100000

@pytest.mark.anyio
async def test_route_model_cascading_missing_key_error():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "", "OPENAI_API_KEY": ""}):
        with pytest.raises(RuntimeError) as excinfo:
            await route_model_cascading(
                compressed_text="Simple luxury trip to Paris",
                images=[],
                destination="Paris",
                budget=100000.0,
                duration=3,
                currency="INR"
            )
        assert "Neither GEMINI_API_KEY nor OPENAI_API_KEY" in str(excinfo.value)

@pytest.mark.anyio
@patch("src.services.ai_client.call_llm", new_callable=AsyncMock)
async def test_route_model_cascading_openai_fallback(mock_call):
    mock_call.return_value = '{"destination": "Paris", "sub_destinations": ["Eiffel Tower"], "overview": "Verbatim intro", "duration_days": 3, "currency": "EUR", "total_price": 100000, "days": [], "inclusions": [], "exclusions": [], "extra_sections": {}}'
    
    # We patch call_llm's side effect to dynamically populate cache_meta["model_used"] = "gpt-4o-mini"
    async def mock_call_side_effect(*args, **kwargs):
        cache_meta = kwargs.get("cache_meta")
        if cache_meta:
            cache_meta["model_used"] = "gpt-4o-mini"
        return mock_call.return_value
    mock_call.side_effect = mock_call_side_effect

    with patch.dict(os.environ, {"GEMINI_API_KEY": "", "OPENAI_API_KEY": "mock-openai-key"}):
        res = await route_model_cascading(
            compressed_text="Simple luxury trip to Paris",
            images=[],
            destination="Paris",
            budget=100000.0,
            duration=3,
            currency="EUR"
        )
        assert res["success"] is True
        assert res["model_used"] == "gpt-4o-mini (faithful-extraction)"
        assert res["detected_destination"] == "Paris"
        assert res["total_price"] == 100000

