import pytest
import json
from unittest.mock import patch, MagicMock, AsyncMock
from src.services.ai_client import call_llm

@pytest.fixture
def mock_keys():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "gemini-key", "OPENAI_API_KEY": "openai-key"}):
        yield

@pytest.mark.anyio
@patch("src.services.ai_client._post_http_call")
async def test_call_llm_gemini_success(mock_post, mock_keys):
    mock_post.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Hello from Gemini"}
                    ]
                }
            }
        ]
    }
    
    res = await call_llm(prompt="Say Hello", provider="gemini")
    assert res == "Hello from Gemini"
    
    mock_post.assert_called_once()
    args = mock_post.call_args[0]
    assert "gemini-2.5-flash" in args[0]
    assert args[1]["contents"][0]["parts"][0]["text"] == "Say Hello"

@pytest.mark.anyio
@patch("src.services.ai_client._post_http_call")
async def test_call_llm_openai_success(mock_post, mock_keys):
    mock_post.return_value = {
        "choices": [
            {
                "message": {
                    "content": "Hello from OpenAI"
                }
            }
        ]
    }
    
    res = await call_llm(prompt="Say Hello", provider="openai")
    assert res == "Hello from OpenAI"
    
    mock_post.assert_called_once()
    args = mock_post.call_args[0]
    assert "completions" in args[0]
    assert args[1]["messages"][0]["content"] == "Say Hello"

@pytest.mark.anyio
@patch("src.services.ai_client._post_http_call")
async def test_call_llm_fallback(mock_post, mock_keys):
    # First call (Gemini) raises error, second call (OpenAI) succeeds
    mock_post.side_effect = [
        Exception("Gemini server error"),
        {
            "choices": [
                {
                    "message": {
                        "content": "Fallback OpenAI Hello"
                    }
                }
            ]
        }
    ]
    
    res = await call_llm(prompt="Say Hello", provider="gemini")
    assert res == "Fallback OpenAI Hello"
    assert mock_post.call_count == 2

@pytest.mark.anyio
@patch("src.services.ai_client._post_http_call")
@patch("src.services.ai_cache_service.get_cached_extraction")
@patch("src.services.ai_cache_service.save_cached_extraction")
async def test_call_llm_caching(mock_save, mock_get, mock_post, mock_keys):
    mock_get.return_value = {"cached_key": "cached_val"}
    
    cache_meta = {
        "agency_id": "agency-1",
        "entity_type": "test",
        "entity_id": "ent-1",
        "prompt_version": "v1",
        "schema_version": "v1"
    }
    
    res = await call_llm(prompt="Say Hello", provider="gemini", cache_meta=cache_meta)
    
    # Assert cache hit -> parsed as json or string
    assert json.loads(res)["cached_key"] == "cached_val"
    mock_get.assert_called_once()
    mock_post.assert_not_called()
    mock_save.assert_not_called()
