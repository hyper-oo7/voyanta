import os
import json
import asyncio
from typing import Dict, Any, Optional
import logging

from .ai_client import call_llm
try:
    from json_repair import repair_json
except ImportError:
    pass

logger = logging.getLogger(__name__)

class StructuredItineraryParser:
    """
    Sends extracted PDF text to an LLM with a strict JSON schema.
    - Chunks text if too long (never exceeds model context)
    - Validates output against expected schema
    - Falls back gracefully if LLM refuses
    """

    MAX_INPUT_TOKENS = 120_000  # Leave headroom for system prompt + output
    CHARS_PER_TOKEN_ESTIMATE = 3.5

    SYSTEM_PROMPT = """You are a travel-document parser.
Extract the itinerary structure from the supplier PDF text provided.
Return ONLY a valid JSON object. No markdown, no explanations, no code blocks (e.g. no ```json).

Rules:
- Identify each day (Day 1, Day 2, … or similar headings).
- For each day, extract: hotels, activities, transfers, meals.
- For hotels: name, location, category, price_per_night (numeric), meal_plan.
- For activities: name, duration, timing, price (numeric).
- For flights: airline, flight_no, origin, destination, cost (numeric), class.
- If a field is missing, use null or omit it. Do NOT hallucinate prices.
- If the text is not an itinerary, return {"is_itinerary": false, "reason": "..."}.

JSON Schema:
{
  "is_itinerary": true,
  "destination": "string or null",
  "days_count": 0,
  "days": [
    {
      "day": 1,
      "title": "string",
      "description": "string",
      "hotels": [{"name":"string","location":"string","category":"string","price_per_night":0,"meal_type":"string"}],
      "activities": [{"name":"string","duration":"string","timing":"string","price":0}],
      "transfers": [{"type":"string","description":"string"}],
      "flights": [{"airline":"string","flight_no":"string","origin":"string","destination":"string","cost":0,"class":"string"}],
      "meals": ["Breakfast","Dinner"],
      "notes": "string"
    }
  ]
}"""

    def __init__(self):
        pass

    def _truncate_text(self, text: str) -> str:
        """Rough token estimator to avoid context overflow."""
        max_chars = int(self.MAX_INPUT_TOKENS * self.CHARS_PER_TOKEN_ESTIMATE)
        if len(text) <= max_chars:
            return text
        # Truncate but try to keep day boundaries
        truncated = text[:max_chars]
        last_day = truncated.rfind("Day ")
        if last_day > max_chars * 0.8:
            return truncated[:last_day]
        return truncated

    async def parse(self, pdf_text: str) -> Dict[str, Any]:
        truncated = self._truncate_text(pdf_text)

        try:
            content = await call_llm(
                prompt=f"Parse this supplier itinerary text into JSON exactly matching the requested schema:\n\n{truncated}",
                system_prompt=self.SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=8192
            )

            if not content:
                raise ValueError("LLM returned empty content")

            # Try strict json load first, fallback to json_repair
            try:
                content_str = str(content)
                if content_str.startswith("```json"):
                    content_str = content_str.split("```json", 1)[1]
                if content_str.endswith("```"):
                    content_str = content_str.rsplit("```", 1)[0]
                content_str = content_str.strip()
                parsed = json.loads(content_str)
            except Exception:
                try:
                    parsed = json.loads(repair_json(str(content)))
                except Exception as e:
                    logger.error(f"Failed to parse LLM JSON: {e}\nContent was: {content}")
                    raise ValueError("LLM returned malformed JSON")

            if not parsed.get("is_itinerary", True):
                raise ValueError(parsed.get("reason", "Document is not a travel itinerary"))

            return self._normalize(parsed)

        except Exception as e:
            logger.error(f"LLM parsing failed: {e}")
            raise

    def _normalize(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure consistent output schema regardless of LLM quirks."""
        days = []
        for d in raw.get("days", []):
            day = {
                "day": int(d.get("day", 0)),
                "title": d.get("title") or f"Day {d.get('day', 0)}",
                "description": d.get("description") or "",
                "hotels": d.get("hotels") or [],
                "activities": d.get("activities") or [],
                "transfers": d.get("transfers") or [],
                "flights": d.get("flights") or [],
                "meals": list(set(d.get("meals") or [])),
                "notes": d.get("notes") or "",
            }
            days.append(day)

        return {
            "destination": raw.get("destination"),
            "days_count": raw.get("days_count") or len(days),
            "days": days,
            "hotels": self._dedupe([h for d in days for h in d["hotels"]]),
            "activities": self._dedupe([a for d in days for a in d["activities"]]),
            "flights": self._dedupe([f for d in days for f in d["flights"]]),
        }

    @staticmethod
    def _dedupe(items: list) -> list:
        seen = set()
        out = []
        for it in items:
            key = json.dumps(it, sort_keys=True, default=str)
            if key not in seen:
                seen.add(key)
                out.append(it)
        return out
