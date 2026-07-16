import os
import httpx
import logging
import json
from typing import Optional, Dict, Any, List
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

from src.services.ai_client import call_llm

async def call_openai_with_retry(payload: dict, headers: dict):
    messages = payload.get("messages") or []
    system_prompt = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_prompt = next((m["content"] for m in messages if m["role"] == "user"), "")
    
    response_schema = payload.get("response_format")
    temperature = payload.get("temperature", 0.0)
    max_tokens = payload.get("max_tokens")
    cache_meta = payload.get("_cache_meta")
    
    res_content = await call_llm(
        prompt=user_prompt,
        system_prompt=system_prompt,
        provider="openai",
        response_schema=response_schema,
        temperature=temperature,
        max_tokens=max_tokens,
        cache_meta=cache_meta
    )
    
    return {
        "choices": [
            {
                "message": {
                    "content": res_content
                }
            }
        ]
    }

async def call_gemini_with_retry(payload: dict, api_key: str):
    contents = payload.get("contents") or []
    user_prompt = ""
    try:
        user_prompt = contents[0]["parts"][0]["text"]
    except Exception:
        pass
        
    system_prompt = None
    try:
        system_prompt = payload["systemInstruction"]["parts"][0]["text"]
    except Exception:
        pass
        
    generation_config = payload.get("generationConfig") or {}
    temperature = generation_config.get("temperature", 0.0)
    max_tokens = generation_config.get("maxOutputTokens")
    
    response_schema = None
    if generation_config.get("responseMimeType") == "application/json":
        response_schema = {"type": "object"}
        
    cache_meta = payload.get("_cache_meta")
    
    res_content = await call_llm(
        prompt=user_prompt,
        system_prompt=system_prompt,
        provider="gemini",
        response_schema=response_schema,
        temperature=temperature,
        max_tokens=max_tokens,
        cache_meta=cache_meta
    )
    
    return {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": res_content
                        }
                    ]
                }
            }
        ]
    }

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

async def enhance_luxury_text(
    text: str,
    mode: str,
    destination: str = "",
    length: Optional[str] = None,
    format: Optional[str] = None
) -> str:
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    if not api_key_gemini:
        return text

    if mode == "day_description":
        length_str = f" The length of the response should be: {length}." if length else " The response should be a rich, descriptive length."
        format_str = f" The format of the response should be: {format}." if format else " Return the response in clean paragraphs."
        prompt = (
            f"You are a luxury travel curator writing about {destination or 'this destination'}. "
            "Expand and rewrite the following itinerary day description to create an immersive, sensory luxury experience. "
            "Make the traveler feel like they are personally in that place experiencing the sights, sounds, and executive comforts. "
            f"{length_str}{format_str} "
            "Return ONLY the expanded text, no quotes, intro, or markdown commentary.\n\n"
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

