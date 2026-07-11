import os
import httpx
import logging
import json
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _call_openai_with_retry_raw(payload: dict, headers: dict):
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
        if r.status_code == 429 or r.status_code >= 500:
            logger.warning(f"OpenAI error {r.status_code}, retrying...")
            raise Exception(f"OpenAI error {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise Exception(f"OpenAI API processing failed: {r.status_code}")
        return r.json()

async def call_openai_with_retry(payload: dict, headers: dict):
    cache_meta = payload.pop("_cache_meta", None)
    if cache_meta:
        agency_id = cache_meta.get("agency_id")
        entity_type = cache_meta.get("entity_type") or "general"
        entity_id = cache_meta.get("entity_id")
        prompt_version = cache_meta.get("prompt_version") or "v1.0.0"
        schema_version = cache_meta.get("schema_version") or "v1.0.0"
        
        input_text = cache_meta.get("input_text")
        if not input_text:
            try:
                input_text = payload["messages"][-1]["content"]
            except Exception:
                input_text = ""
                
        model = cache_meta.get("model") or payload.get("model") or "gpt-4o-mini"
        
        from src.services.ai_cache_service import get_cached_extraction, save_cached_extraction
        cached = await get_cached_extraction(agency_id, model, prompt_version, schema_version, input_text)
        if cached is not None:
            text_val = json.dumps(cached) if isinstance(cached, (dict, list)) else str(cached)
            return {
                "choices": [
                    {
                        "message": {
                            "content": text_val
                        }
                    }
                ]
            }
            
        result = await _call_openai_with_retry_raw(payload, headers)
        try:
            content = result["choices"][0]["message"]["content"]
            try:
                parsed_data = json.loads(content)
            except Exception:
                parsed_data = content
                
            await save_cached_extraction(
                agency_id=agency_id,
                entity_type=entity_type,
                entity_id=entity_id,
                model=model,
                prompt_version=prompt_version,
                schema_version=schema_version,
                normalized_input=input_text,
                output_json=parsed_data
            )
        except Exception as e:
            logger.warning(f"[AICache] Failed to parse and cache OpenAI response: {e}")
        return result
    else:
        return await _call_openai_with_retry_raw(payload, headers)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _call_gemini_with_retry_raw(payload: dict, api_key: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=payload, headers=headers)
        if r.status_code == 429 or r.status_code >= 500:
            logger.warning(f"Gemini error {r.status_code}, retrying...")
            raise Exception(f"Gemini error {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise Exception(f"Gemini API processing failed: {r.status_code} - {r.text}")
        return r.json()

async def call_gemini_with_retry(payload: dict, api_key: str):
    cache_meta = payload.pop("_cache_meta", None)
    if cache_meta:
        agency_id = cache_meta.get("agency_id")
        entity_type = cache_meta.get("entity_type") or "general"
        entity_id = cache_meta.get("entity_id")
        prompt_version = cache_meta.get("prompt_version") or "v1.0.0"
        schema_version = cache_meta.get("schema_version") or "v1.0.0"
        
        input_text = cache_meta.get("input_text")
        if not input_text:
            try:
                input_text = payload["contents"][0]["parts"][0]["text"]
            except Exception:
                input_text = ""
                
        model = cache_meta.get("model") or "gemini-2.5-flash"
        
        from src.services.ai_cache_service import get_cached_extraction, save_cached_extraction
        cached = await get_cached_extraction(agency_id, model, prompt_version, schema_version, input_text)
        if cached is not None:
            text_val = json.dumps(cached) if isinstance(cached, (dict, list)) else str(cached)
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": text_val
                                }
                            ]
                        }
                    }
                ]
            }
            
        result = await _call_gemini_with_retry_raw(payload, api_key)
        try:
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            try:
                parsed_data = json.loads(content)
            except Exception:
                parsed_data = content
                
            await save_cached_extraction(
                agency_id=agency_id,
                entity_type=entity_type,
                entity_id=entity_id,
                model=model,
                prompt_version=prompt_version,
                schema_version=schema_version,
                normalized_input=input_text,
                output_json=parsed_data
            )
        except Exception as e:
            logger.warning(f"[AICache] Failed to parse and cache Gemini response: {e}")
        return result
    else:
        return await _call_gemini_with_retry_raw(payload, api_key)

async def extract_itinerary(text: str) -> dict:
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    api_key_openai = os.environ.get("OPENAI_API_KEY")
    
    if not api_key_gemini and not api_key_openai:
        raise Exception("Neither GEMINI_API_KEY nor OPENAI_API_KEY configured on backend")
    
    system_prompt = (
        "You are an expert travel assistant. Parse the following travel itinerary text and extract: "
        "Days (with title, day number, and description), Hotels (name, location, price if any), "
        "Activities, Transfers, Meals, and Notes. "
        "Return a JSON object matching this schema without markdown code blocks:\n"
        "{\n"
        "  \"name\": \"Name of the tour/itinerary\",\n"
        "  \"destination\": \"Main destination country/city\",\n"
        "  \"days_count\": 7,\n"
        "  \"days\": [\n"
        "    {\n"
        "      \"day\": 1,\n"
        "      \"title\": \"Arrival in Paris\",\n"
        "      \"description\": \"Morning VIP transfer...\",\n"
        "      \"hotels\": [\"Hotel A\"],\n"
        "      \"activities\": [\"Louvre private tour\"],\n"
        "      \"transfers\": [\"Private chauffeur transfer\"],\n"
        "      \"meals\": [\"Breakfast\", \"Dinner\"],\n"
        "      \"notes\": \"Dress code is formal for dinner.\"\n"
        "    }\n"
        "  ],\n"
        "  \"hotels\": [\n"
        "    { \"name\": \"Hotel name\", \"location\": \"Hotel location\", \"price_per_night\": 420 }\n"
        "  ],\n"
        "  \"activities\": [\n"
        "    { \"name\": \"Activity name\", \"price\": 75, \"description\": \"description\" }\n"
        "  ]\n"
        "}"
    )

    import json
    try:
        if api_key_gemini:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": f"{system_prompt}\n\nItinerary text:\n{text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }
            result = await call_gemini_with_retry(payload, api_key_gemini)
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(content)
        else:
            headers = {
                "Authorization": f"Bearer {api_key_openai}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                "response_format": { "type": "json_object" }
            }
            result = await call_openai_with_retry(payload, headers)
            content = result["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        logger.exception("parse itinerary failed")
        raise e

async def translate_proposal_content(proposal_data: dict, target_lang: str, glossary: dict = None) -> dict:
    import json
    lang_names = {
        "bn": "Bengali (বাংলা)",
        "hi": "Hindi (हिंदी)",
        "gu": "Gujarati (ગુજરાતી)",
        "mr": "Marathi (मराठी)",
        "es": "Spanish (Español)",
        "fr": "French (Français)",
        "en": "English"
    }
    target_name = lang_names.get(target_lang, target_lang)
    if target_lang == "en" or not target_name:
        return proposal_data

    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    api_key_openai = os.environ.get("OPENAI_API_KEY")
    
    if not api_key_gemini and not api_key_openai:
        logger.warning("[AI Translate] No API keys configured; returning original proposal structure for fallback UI translation.")
        return proposal_data

    to_translate = {
        "title": proposal_data.get("title", ""),
        "highlights": proposal_data.get("highlights", []),
        "inclusions": proposal_data.get("inclusions", []),
        "exclusions": proposal_data.get("exclusions", []),
        "terms_of_payment": proposal_data.get("terms_of_payment", []),
        "days": []
    }
    for d in proposal_data.get("days", []):
        to_translate["days"].append({
            "title": d.get("title", ""),
            "description": d.get("description", "")
        })

    glossary_text = ""
    if glossary:
        glossary_text = "4. Use the following exact terminology for these specific words to ensure consistency with our UI:\n" + json.dumps(glossary, ensure_ascii=False) + "\n"

    prompt = (
        f"You are a professional luxury travel translator. Translate all string values in this JSON object into {target_name}.\n"
        "RULES:\n"
        "1. Keep exact JSON structure and keys intact.\n"
        "2. Do not translate numbers, currency symbols, or dates.\n"
        "3. Maintain warm, professional hospitality tone.\n"
        f"{glossary_text}"
        f"JSON to translate:\n{json.dumps(to_translate, ensure_ascii=False)}"
    )

    try:
        if api_key_gemini:
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
            }
            res = await call_gemini_with_retry(payload, api_key_gemini)
            translated_dict = json.loads(res["candidates"][0]["content"]["parts"][0]["text"])
        else:
            headers = {"Authorization": f"Bearer {api_key_openai}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            }
            res = await call_openai_with_retry(payload, headers)
            translated_dict = json.loads(res["choices"][0]["message"]["content"])

        merged = dict(proposal_data)
        if "title" in translated_dict: merged["title"] = translated_dict["title"]
        if "highlights" in translated_dict: merged["highlights"] = translated_dict["highlights"]
        if "inclusions" in translated_dict: merged["inclusions"] = translated_dict["inclusions"]
        if "exclusions" in translated_dict: merged["exclusions"] = translated_dict["exclusions"]
        if "terms_of_payment" in translated_dict: merged["terms_of_payment"] = translated_dict["terms_of_payment"]
        
        if "days" in translated_dict and len(translated_dict["days"]) == len(merged.get("days", [])):
            new_days = []
            for idx, d in enumerate(merged.get("days", [])):
                d_copy = dict(d)
                d_copy["title"] = translated_dict["days"][idx].get("title", d_copy.get("title", ""))
                d_copy["description"] = translated_dict["days"][idx].get("description", d_copy.get("description", ""))
                new_days.append(d_copy)
            merged["days"] = new_days
            
        return merged
    except Exception as e:
        logger.exception(f"[AI Translate] Translation failed: {e}. Returning original data.")
        return proposal_data

async def generate_luxury_title(destination: str, tour_type: str, duration: int) -> str:
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    prompt = (
        f"Generate a captivating, luxury travel proposal title for a {duration}-day trip to {destination or 'Your Destination'}"
        f"{' (' + tour_type + ')' if tour_type else ''}. "
        "Return ONLY the title string, no quotes, no extra text. Example: Enchanting Amalfi Coast: 7 Days of Executive Coastal Luxury"
    )
    if api_key_gemini:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7}
        }
        res = await call_gemini_with_retry(payload, api_key_gemini)
        return res["candidates"][0]["content"]["parts"][0]["text"].strip().strip('"').strip("'")
    else:
        return f"{destination or 'Luxury'} Collection: A Curated {duration}-Day {tour_type or 'Journey'}"

async def enhance_luxury_text(text: str, mode: str, destination: str = "") -> str:
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    if not api_key_gemini:
        return text

    if mode == "day_description":
        prompt = (
            f"You are a luxury travel curator writing about {destination or 'this destination'}. "
            "Expand and rewrite the following itinerary day description to create an immersive, sensory luxury experience. "
            "Make the traveler feel like they are personally in that place experiencing the sights, sounds, and executive comforts. "
            "Return ONLY the expanded paragraph text, no quotes or intro.\n\n"
            f"Original text: {text}"
        )
    else:
        label_map = {
            "inclusions": "What's Included (luxury inclusions)",
            "exclusions": "What's Excluded (clear professional exclusions)",
            "what_to_pack": "What to Pack (luxury travel essentials)",
            "terms_of_payment": "Terms of Payment (professional executive terms)"
        }
        section_name = label_map.get(mode, mode)
        prompt = (
            f"Check the following text for grammar and errors, correct any mistakes, and rewrite it in an elegant, polished, professional luxury agency style for the section '{section_name}'. "
            "Keep itemized bullet points or line breaks clean. Return ONLY the rewritten text, no commentary or markdown code blocks.\n\n"
            f"Original text:\n{text}"
        )

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4}
    }
    res = await call_gemini_with_retry(payload, api_key_gemini)
    return res["candidates"][0]["content"]["parts"][0]["text"].strip()

