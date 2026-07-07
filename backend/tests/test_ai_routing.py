"""Tests for cascading AI routing and fallback in cascading_ai_service."""
import os
import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from src.services.cascading_ai_service import route_model_cascading

def test_route_model_cascading_openai_success():
    async def run_test():
        with patch.dict(os.environ, {"OPENAI_API_KEY": "mock-openai-key", "GEMINI_API_KEY": ""}):
            with patch("src.services.ai_service.call_openai_with_retry", new_callable=AsyncMock) as mock_call:
                mock_call.return_value = {
                    "choices": [{
                        "message": {
                            "content": '{"recommendations": [{"option_id": "opt_1", "option_title": "Test Opt", "total_estimated_cost": 100000, "days": []}]}'
                        }
                    }]
                }
                res = await route_model_cascading(
                    compressed_text="Simple luxury trip to Paris",
                    images=[{"url": "http://img.com/1.jpg"}],
                    destination="Paris",
                    budget=100000.0,
                    duration=3,
                    currency="INR"
                )
                assert res["success"] is True
                assert res["model_used"] == "gpt-4o-mini"
                assert len(res["recommendations"]) == 1
    asyncio.run(run_test())

def test_route_model_cascading_fallback_when_no_keys():
    async def run_test():
        with patch.dict(os.environ, {"OPENAI_API_KEY": "", "GEMINI_API_KEY": "", "ANTHROPIC_API_KEY": ""}):
            res = await route_model_cascading(
                compressed_text="Simple luxury trip to Paris",
                images=[],
                destination="Paris",
                budget=100000.0,
                duration=3,
                currency="INR"
            )
            assert res["success"] is True
            assert res["model_used"] == "cascading-dynamic-routing"
            assert len(res["recommendations"]) >= 2
            for r in res["recommendations"]:
                assert 80000 <= r["total_estimated_cost"] <= 120000  # within ±20% budget window
    asyncio.run(run_test())

