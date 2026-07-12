"""Tests for cascading AI routing in cascading_ai_service."""
import os
import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from src.services.cascading_ai_service import route_model_cascading

def test_route_model_cascading_gemini_success():
    async def run_test():
        with patch.dict(os.environ, {"GEMINI_API_KEY": "mock-gemini-key"}):
            with patch("src.services.ai_service.call_gemini_with_retry", new_callable=AsyncMock) as mock_call:
                mock_call.return_value = {
                    "candidates": [{
                        "content": {
                            "parts": [{
                                "text": '{"destination": "Paris", "sub_destinations": ["Eiffel Tower"], "overview": "Verbatim intro", "duration_days": 3, "currency": "EUR", "total_price": 100000, "days": [], "inclusions": [], "exclusions": [], "extra_sections": {}}'
                            }]
                        }
                    }]
                }
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
    asyncio.run(run_test())

def test_route_model_cascading_missing_key_error():
    async def run_test():
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with pytest.raises(RuntimeError) as excinfo:
                await route_model_cascading(
                    compressed_text="Simple luxury trip to Paris",
                    images=[],
                    destination="Paris",
                    budget=100000.0,
                    duration=3,
                    currency="INR"
                )
            assert "GEMINI_API_KEY not configured" in str(excinfo.value)
    asyncio.run(run_test())
