import os
import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def call_openai_with_retry(payload: dict, headers: dict):
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
        if r.status_code == 429 or r.status_code >= 500:
            logger.warning(f"OpenAI error {r.status_code}, retrying...")
            raise Exception(f"OpenAI error {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise Exception(f"OpenAI API processing failed: {r.status_code}")
        return r.json()

async def extract_itinerary(text: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise Exception("OpenAI API key not configured on backend")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert travel assistant. Parse the following travel itinerary text and extract: "
                    "Days (with title, day number, and description), Hotels (name, location, price if any), "
                    "Activities, Transfers, Meals, and Notes. "
                    "Return a JSON object matching this schema: "
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
            },
            {
                "role": "user",
                "content": text
            }
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        result = await call_openai_with_retry(payload, headers)
        import json
        content = result["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        logger.exception("parse itinerary failed")
        raise e
