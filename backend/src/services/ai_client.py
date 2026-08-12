import os
import json
import logging
import httpx
import re
from typing import Any, Dict, List, Optional
import tenacity
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
OPENAI_MODEL = "gpt-4o-mini"

GEMINI_MAX_OUTPUT_TOKENS = 65536
OPENAI_MAX_OUTPUT_TOKENS = 16384

_MODEL_SPECIFIC_MARKERS = (
    "NOT_FOUND",
    "not found",
    "not supported",
    "is not available",
)
_MODEL_SPECIFIC_STATUSES = ("400", "404", "429", "503")


class AIServiceError(Exception):
    pass

class RetriableAIServiceError(AIServiceError):
    pass


class TruncatedResponseError(AIServiceError):
    """The model stopped because it hit the output-token ceiling."""


class ContentBlockedError(AIServiceError):
    """The model refused to answer (safety / recitation filters)."""


def _is_model_specific_error(exc: Exception, err_str: str) -> bool:
    """
    Decide whether to fall through to the next Gemini model.

    Only the status code prefix we control (`LLM API processing failed: 404 - ...`)
    is inspected, so a number that merely appears in an echoed response body —
    a price like 400, say — no longer triggers pointless model hopping.
    """
    if isinstance(exc, RetriableAIServiceError):
        return True
    if any(marker in err_str for marker in _MODEL_SPECIFIC_MARKERS):
        return True
    status_prefix = err_str.split(" - ", 1)[0]
    return any(code in status_prefix for code in _MODEL_SPECIFIC_STATUSES)


# Gemini's `responseSchema` accepts an OpenAPI 3.0 subset, not full JSON Schema:
# `$defs`/`$ref`, `allOf`, `title`, `default` and `additionalProperties` are all
# rejected with a 400. Pydantic's `model_json_schema()` emits every one of them,
# so nested models have to be inlined before the payload goes out.
_GEMINI_FORMATS = {
    "STRING": ("date-time", "enum"),
    "INTEGER": ("int32", "int64"),
    "NUMBER": ("float", "double"),
}


def _convert_schema_node(node: Any, defs: Dict[str, Any], seen: frozenset) -> Optional[dict]:
    """Translate one JSON-Schema node into Gemini's Schema shape, inlining `$ref`s."""
    if not isinstance(node, dict):
        return None

    if "$ref" in node:
        name = str(node["$ref"]).rsplit("/", 1)[-1]
        if name not in defs or name in seen:
            # Unknown or self-referencing model: Gemini cannot express recursion.
            return {"type": "STRING", "description": f"Unresolved reference: {name}"}
        return _convert_schema_node(defs[name], defs, seen | {name})

    if isinstance(node.get("allOf"), list):
        merged: Dict[str, Any] = {}
        for sub in node["allOf"]:
            converted = _convert_schema_node(sub, defs, seen) or {}
            props = converted.pop("properties", None)
            required = converted.pop("required", None)
            converted.pop("propertyOrdering", None)
            if props:
                merged.setdefault("properties", {}).update(props)
            if required:
                merged["required"] = list(dict.fromkeys(merged.get("required", []) + list(required)))
            for key, value in converted.items():
                merged.setdefault(key, value)
        if merged.get("properties"):
            merged["propertyOrdering"] = list(merged["properties"])
        if node.get("description"):
            merged["description"] = node["description"]
        return merged or None

    union_key = "anyOf" if "anyOf" in node else ("oneOf" if "oneOf" in node else None)
    if union_key:
        nullable = False
        variants = []
        for sub in node.get(union_key) or []:
            if isinstance(sub, dict) and sub.get("type") == "null":
                nullable = True
                continue
            converted = _convert_schema_node(sub, defs, seen)
            if converted:
                variants.append(converted)
        if not variants:
            result: Dict[str, Any] = {"type": "STRING"}
        elif len(variants) == 1:
            # `Optional[X]` collapses to X plus `nullable`, which Gemini understands.
            result = variants[0]
        else:
            result = {"anyOf": variants}
        if nullable:
            result["nullable"] = True
        if node.get("description"):
            result["description"] = node["description"]
        return result

    out: Dict[str, Any] = {}
    node_type = node.get("type")
    if isinstance(node_type, list):
        concrete = [t for t in node_type if t != "null"]
        if len(concrete) != len(node_type):
            out["nullable"] = True
        node_type = concrete[0] if concrete else None
    if isinstance(node_type, str):
        out["type"] = node_type.upper()

    if node.get("description"):
        out["description"] = node["description"]
    if node.get("enum"):
        out["type"] = "STRING"
        out["enum"] = [str(v) for v in node["enum"]]
    if node.get("format") in _GEMINI_FORMATS.get(out.get("type", ""), ()):
        out["format"] = node["format"]

    if out.get("type") == "ARRAY" or "items" in node:
        out["type"] = "ARRAY"
        out["items"] = _convert_schema_node(node.get("items"), defs, seen) or {"type": "STRING"}
        for bound in ("minItems", "maxItems"):
            if isinstance(node.get(bound), int):
                out[bound] = node[bound]

    if out.get("type") == "OBJECT" or "properties" in node:
        out["type"] = "OBJECT"
        properties = {}
        for name, sub in (node.get("properties") or {}).items():
            converted = _convert_schema_node(sub, defs, seen)
            if converted:
                properties[name] = converted
        if properties:
            out["properties"] = properties
            out["propertyOrdering"] = list(properties)
            # Gemini only reliably emits properties named in `required`, and every
            # Pydantic field carrying a default lands outside JSON Schema's
            # `required` — which is how whole itineraries came back with `days`
            # missing. Ask for all of them; optionality still rides on `nullable`,
            # and Pydantic re-applies the real defaults when it validates.
            out["required"] = list(properties)

    if not out.get("type"):
        out["type"] = "OBJECT" if out.get("properties") else "STRING"
    return out


def to_gemini_response_schema(schema: Optional[dict]) -> Optional[dict]:
    """
    Flatten a Pydantic/JSON-Schema dict into the subset Gemini's
    `generationConfig.responseSchema` accepts. Returns None when the result
    carries no properties, so the caller can fall back to plain JSON mode.
    """
    if not isinstance(schema, dict):
        return None
    defs: Dict[str, Any] = {}
    for key in ("$defs", "definitions"):
        if isinstance(schema.get(key), dict):
            defs.update(schema[key])
    converted = _convert_schema_node(schema, defs, frozenset())
    if not converted or not converted.get("properties"):
        return None
    return converted


def _extract_openai_text(res: dict) -> str:
    """Safely unwrap an OpenAI chat.completions response."""
    choices = (res or {}).get("choices") or []
    if not choices:
        raise AIServiceError(f"{OPENAI_MODEL} returned no choices.")

    choice = choices[0]
    finish_reason = choice.get("finish_reason")
    content = ((choice.get("message") or {}).get("content") or "").strip()

    if content:
        if finish_reason == "length":
            logger.warning(
                "[AIClient] %s hit max_tokens; the response is likely truncated.",
                OPENAI_MODEL,
            )
        return content

    if finish_reason == "length":
        raise TruncatedResponseError(
            f"{OPENAI_MODEL} hit the output token limit before emitting any content."
        )
    if finish_reason == "content_filter":
        raise ContentBlockedError(f"{OPENAI_MODEL} refused to answer (content filter).")
    raise AIServiceError(
        f"{OPENAI_MODEL} returned an empty response (finish_reason: {finish_reason or 'unknown'})."
    )


def _extract_gemini_text(res: dict, model: str) -> str:
    """
    Safely unwrap a Gemini generateContent response.

    Gemini returns HTTP 200 with a candidate that carries no `parts` when it
    stops on MAX_TOKENS, SAFETY or RECITATION. Indexing straight into
    ["candidates"][0]["content"]["parts"][0]["text"] raised KeyError/IndexError
    for those cases, which callers then misreported as malformed JSON.
    """
    candidates = (res or {}).get("candidates") or []
    if not candidates:
        feedback = (res or {}).get("promptFeedback") or {}
        block_reason = feedback.get("blockReason")
        if block_reason:
            raise ContentBlockedError(
                f"{model} blocked the prompt (reason: {block_reason})."
            )
        raise AIServiceError(f"{model} returned no candidates.")

    candidate = candidates[0]
    finish_reason = candidate.get("finishReason")
    parts = ((candidate.get("content") or {}).get("parts")) or []
    text = "".join(part.get("text", "") for part in parts).strip()

    if text:
        if finish_reason == "MAX_TOKENS":
            logger.warning(
                "[AIClient] %s hit maxOutputTokens; the response is likely truncated.",
                model,
            )
        return text

    if finish_reason == "MAX_TOKENS":
        raise TruncatedResponseError(
            f"{model} hit the output token limit before emitting any content. "
            "Reduce the input size or raise max_tokens."
        )
    if finish_reason in ("SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"):
        raise ContentBlockedError(
            f"{model} refused to answer (finishReason: {finish_reason})."
        )
    raise AIServiceError(
        f"{model} returned an empty response (finishReason: {finish_reason or 'unknown'})."
    )

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((RetriableAIServiceError, httpx.NetworkError, httpx.TimeoutException))
)
async def _post_http_call(url: str, json_payload: dict, headers: dict) -> dict:
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(url, json=json_payload, headers=headers)
        if r.status_code == 429 or r.status_code >= 500:
            logger.warning(f"LLM API retriable error {r.status_code}, retrying...")
            raise RetriableAIServiceError(f"LLM error {r.status_code}: {r.text}")
        if r.status_code != 200:
            # Non-retriable error (400, 401, 403, 404). Raise AIServiceError so we try next model/provider immediately!
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
            models_to_try = [GEMINI_MODEL, "gemini-flash-latest", "gemini-pro-latest"]
            last_err = None
            for g_model in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent"
                headers = {
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key_gemini,
                }
                
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
                    payload["generationConfig"]["maxOutputTokens"] = min(max_tokens, GEMINI_MAX_OUTPUT_TOKENS)
                if response_schema:
                    payload["generationConfig"]["responseMimeType"] = "application/json"
                    gemini_schema = to_gemini_response_schema(response_schema)
                    if gemini_schema:
                        payload["generationConfig"]["responseSchema"] = gemini_schema

                if system_prompt:
                    payload["systemInstruction"] = {
                        "parts": [{"text": system_prompt}]
                    }
                try:
                    res = await _post_http_call(url, payload, headers)
                    return _extract_gemini_text(res, g_model)
                except TruncatedResponseError:
                    raise
                except Exception as e:
                    last_err = e
                    err_str = str(e)
                    is_model_specific = _is_model_specific_error(e, err_str)
                    if not is_model_specific or g_model == models_to_try[-1]:
                        raise e
                    logger.warning(f"Gemini model {g_model} failed with model-specific error ({err_str}). Trying next Gemini model.")
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
                payload["max_tokens"] = min(max_tokens, OPENAI_MAX_OUTPUT_TOKENS)
            if response_schema:
                payload["response_format"] = {"type": "json_object"}

            res = await _post_http_call(url, payload, headers)
            return _extract_openai_text(res)

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
