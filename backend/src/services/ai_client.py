import os
import json
import logging
import httpx
import re
from typing import Any, Dict, List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"
OPENAI_MODEL = "gpt-4o-mini"

class AIServiceError(Exception):
    pass

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _post_http_call(url: str, json_payload: dict, headers: dict) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=json_payload, headers=headers)
        if r.status_code == 429 or r.status_code >= 500:
            logger.warning(f"LLM API error {r.status_code}, retrying...")
            raise AIServiceError(f"LLM error {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise AIServiceError(f"LLM API processing failed: {r.status_code} - {r.text}")
        return r.json()

async def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    provider: Optional[str] = None,  # "gemini" or "openai"
    images: Optional[List[dict]] = None,
    response_schema: Optional[dict] = None,
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
    cache_meta: Optional[dict] = None
) -> str:
    """
    Unified entry point for AI text & vision generation across all modules.
    
    Implements:
    - Automatic provider fallback (e.g. Gemini falls back to OpenAI if Gemini fails or is not configured)
    - Semantic / exact input caching via get_cached_extraction & save_cached_extraction
    - Tenacity retry policies
    """
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    api_key_openai = os.environ.get("OPENAI_API_KEY")

    # Determine default provider based on configuration and preference
    if not provider:
        provider = "gemini" if api_key_gemini else "openai"

    # Strict check for api keys
    if provider == "gemini" and not api_key_gemini:
        if api_key_openai:
            logger.warning("GEMINI_API_KEY requested but not set; falling back to OpenAI.")
            provider = "openai"
        else:
            raise RuntimeError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured.")
    elif provider == "openai" and not api_key_openai:
        if api_key_gemini:
            logger.warning("OPENAI_API_KEY requested but not set; falling back to Gemini.")
            provider = "gemini"
        else:
            raise RuntimeError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured.")

    # 1. Cache lookup if cache metadata is provided
    if cache_meta:
        agency_id = cache_meta.get("agency_id")
        entity_type = cache_meta.get("entity_type") or "general"
        entity_id = cache_meta.get("entity_id")
        prompt_version = cache_meta.get("prompt_version") or "v1.0.0"
        schema_version = cache_meta.get("schema_version") or "v1.0.0"
        input_text = cache_meta.get("input_text") or prompt
        model = cache_meta.get("model") or (GEMINI_MODEL if provider == "gemini" else OPENAI_MODEL)

        from src.services.ai_cache_service import get_cached_extraction, save_cached_extraction
        cached = await get_cached_extraction(agency_id, model, prompt_version, schema_version, input_text)
        if cached is not None:
            logger.info(f"[AICache] Cache HIT for entity_type={entity_type}")
            return json.dumps(cached) if isinstance(cached, (dict, list)) else str(cached)

    # Helper function to perform the actual call based on the resolved provider
    async def execute_call(active_provider: str) -> str:
        if active_provider == "gemini":
            models_to_try = [GEMINI_MODEL, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"]
            last_err = None
            for g_model in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent?key={api_key_gemini}"
                headers = {"Content-Type": "application/json"}
                
                parts = [{"text": prompt}]
                if images:
                    for img in images:
                        if "mime_type" in img and "data" in img:
                            parts.append({
                                "inlineData": {
                                    "mimeType": img["mime_type"],
                                    "data": img["data"]
                                }
                            })
                
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": parts
                    }],
                    "generationConfig": {
                        "temperature": temperature,
                    }
                }
                if max_tokens:
                    payload["generationConfig"]["maxOutputTokens"] = min(max_tokens, 8192)
                if response_schema:
                    payload["generationConfig"]["responseMimeType"] = "application/json"
                    
                if system_prompt:
                    payload["systemInstruction"] = {
                        "parts": [{"text": system_prompt}]
                    }
                try:
                    res = await _post_http_call(url, payload, headers)
                    return res["candidates"][0]["content"]["parts"][0]["text"]
                except Exception as e:
                    last_err = e
                    logger.warning(f"Gemini model {g_model} failed: {e}. Trying fallback Gemini model.")
            raise last_err or AIServiceError("All Gemini model endpoints failed.")
            
        else:  # openai
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key_openai}",
                "Content-Type": "application/json"
            }
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            user_content = prompt
            if images:
                user_content = [{"type": "text", "text": prompt}]
                for img in images:
                    if "data" in img:
                        mime = img.get("mime_type", "image/jpeg")
                        user_content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{img['data']}"
                            }
                        })
                    elif "url" in img:
                        user_content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": img["url"]
                            }
                        })
            
            messages.append({"role": "user", "content": user_content})
            
            payload = {
                "model": OPENAI_MODEL,
                "messages": messages,
                "temperature": temperature
            }
            if max_tokens:
                payload["max_tokens"] = min(max_tokens, 4096)
            if response_schema:
                payload["response_format"] = {"type": "json_object"}
                
            res = await _post_http_call(url, payload, headers)
            return res["choices"][0]["message"]["content"]

    # 2. Execute the call with cascading fallback support
    text_result = None
    try:
        text_result = await execute_call(provider)
        if cache_meta:
            cache_meta["model_used"] = GEMINI_MODEL if provider == "gemini" else OPENAI_MODEL
    except Exception as e:
        logger.warning(f"AI call failed for provider {provider}: {e}")
        # Attempt cascading fallback to the other provider
        fallback_provider = "openai" if provider == "gemini" else "gemini"
        fallback_key = api_key_openai if fallback_provider == "openai" else api_key_gemini
        
        if fallback_key:
            logger.info(f"Cascading fallback: switching from {provider} to {fallback_provider}")
            try:
                text_result = await execute_call(fallback_provider)
                provider = fallback_provider  # Update active provider for caching
                if cache_meta:
                    cache_meta["model_used"] = GEMINI_MODEL if provider == "gemini" else OPENAI_MODEL
            except Exception as fe:
                logger.error(f"Fallback AI call to {fallback_provider} also failed: {fe}")
                raise fe
        else:
            raise e

    # 3. Cache the result if cache metadata is provided
    if cache_meta and text_result:
        try:
            parsed_data = json.loads(text_result)
        except Exception:
            json_match = re.search(r'\{[\s\S]+\}', text_result)
            if json_match:
                try:
                    parsed_data = json.loads(json_match.group())
                except Exception:
                    parsed_data = text_result
            else:
                parsed_data = text_result

        try:
            await save_cached_extraction(
                agency_id=agency_id,
                entity_type=entity_type,
                entity_id=entity_id,
                model=GEMINI_MODEL if provider == "gemini" else OPENAI_MODEL,
                prompt_version=prompt_version,
                schema_version=schema_version,
                normalized_input=input_text,
                output_json=parsed_data
            )
        except Exception as ce:
            logger.warning(f"[AICache] Failed to save cache: {ce}")

    return text_result
