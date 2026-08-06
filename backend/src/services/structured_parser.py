import os
import json
import re
import asyncio
from typing import Dict, Any, List, Optional
import logging

from .ai_client import call_llm
from .json_utils import MalformedLLMJsonError, loads_forgiving

logger = logging.getLogger(__name__)


class EmptyDocumentError(ValueError):
    """The PDF yielded no extractable text (typically a scan with no OCR layer)."""


class StructuredItineraryParser:
    """
    Sends extracted PDF text to an LLM with a strict JSON schema.
    - Splits long documents on day boundaries and parses each chunk, then merges
    - Validates output against expected schema
    - Falls back gracefully if LLM refuses
    """


    MAX_CHARS_PER_CALL = 120_000
    MAX_TOTAL_CHARS = 600_000
    MAX_OUTPUT_TOKENS = 32_768
    MIN_USABLE_CHARS = 40

    _DAY_HEADING = re.compile(r"^\s*day\s*[-:]?\s*\d+", re.IGNORECASE | re.MULTILINE)

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

    def _split_into_chunks(self, text: str) -> List[str]:
        """
        Split `text` into pieces that each fit within MAX_CHARS_PER_CALL.

        Prefers day headings ("Day 3", "DAY-4:") as boundaries so a single day is
        never cut in half; falls back to blank-line boundaries, and finally to a
        hard slice for text with no structure at all.
        """
        if len(text) <= self.MAX_CHARS_PER_CALL:
            return [text]

        if len(text) > self.MAX_TOTAL_CHARS:
            logger.warning(
                "[StructuredParser] Document is %d chars; only the first %d will be parsed.",
                len(text), self.MAX_TOTAL_CHARS,
            )
            text = text[: self.MAX_TOTAL_CHARS]

        boundaries = [m.start() for m in self._DAY_HEADING.finditer(text)]
        if len(boundaries) < 2:
            # No day structure — fall back to paragraph boundaries.
            boundaries = [m.start() for m in re.finditer(r"\n\s*\n", text)]
        if not boundaries:
            return [
                text[i: i + self.MAX_CHARS_PER_CALL]
                for i in range(0, len(text), self.MAX_CHARS_PER_CALL)
            ]

        # Always start at 0 and terminate at the end of the text.
        points = sorted({0, *boundaries, len(text)})
        chunks: List[str] = []
        start = points[0]
        for idx in range(1, len(points)):
            # Extend the current chunk until adding the next segment would
            # overflow the budget, then close it off.
            is_last = idx == len(points) - 1
            next_end = points[idx]
            if next_end - start >= self.MAX_CHARS_PER_CALL or is_last:
                piece = text[start:next_end].strip()
                if piece:
                    chunks.append(piece)
                start = next_end

        return chunks or [text[: self.MAX_CHARS_PER_CALL]]

    async def _parse_chunk(self, chunk: str, index: int, total: int) -> Dict[str, Any]:
        """Parse a single chunk of document text into the raw schema dict."""
        context = ""
        if total > 1:
            context = (
                f"\n\nNOTE: this is part {index + 1} of {total} of a longer document. "
                "Extract only the days present in this part; keep the original day numbers."
            )

        content = await call_llm(
            prompt=(
                "Parse this supplier itinerary text into JSON exactly matching the "
                f"requested schema:{context}\n\n{chunk}"
            ),
            system_prompt=self.SYSTEM_PROMPT,
            temperature=0.1,
            response_schema={"type": "object"},
            max_tokens=self.MAX_OUTPUT_TOKENS,
        )

        try:
            return loads_forgiving(content)
        except MalformedLLMJsonError as e:
            logger.error("Failed to parse LLM JSON for chunk %d/%d: %s", index + 1, total, e)
            raise

    @staticmethod
    def _merge_parsed(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge per-chunk results into one raw payload, de-duplicating by day number."""
        merged: Dict[str, Any] = {"is_itinerary": True, "destination": None, "days": []}
        seen_days = set()

        for part in results:
            if merged["destination"] is None and part.get("destination"):
                merged["destination"] = part.get("destination")
            for day in part.get("days") or []:
                key = day.get("day")
                # Days without a usable number are always kept; numbered days win once.
                if key is not None and key in seen_days:
                    continue
                if key is not None:
                    seen_days.add(key)
                merged["days"].append(day)

        merged["days"].sort(key=lambda d: (d.get("day") is None, d.get("day") or 0))
        merged["days_count"] = len(merged["days"])
        return merged

    async def parse(self, pdf_text: str) -> Dict[str, Any]:
        text = (pdf_text or "").strip()
        if len(text) < self.MIN_USABLE_CHARS:
            raise EmptyDocumentError(
                "No readable text found in this PDF. It looks like a scanned image "
                "without a text layer — run it through OCR first, or paste the "
                "itinerary text manually."
            )

        chunks = self._split_into_chunks(text)
        if len(chunks) > 1:
            logger.info(
                "[StructuredParser] Document split into %d chunks (%d chars total).",
                len(chunks), len(text),
            )

        try:
            results = []
            for i, chunk in enumerate(chunks):
                results.append(await self._parse_chunk(chunk, i, len(chunks)))

            # A "not an itinerary" verdict only counts when every chunk agrees.
            if all(not r.get("is_itinerary", True) for r in results):
                reason = next(
                    (r.get("reason") for r in results if r.get("reason")),
                    "Document is not a travel itinerary",
                )
                raise ValueError(reason)

            usable = [r for r in results if r.get("is_itinerary", True)]
            parsed = usable[0] if len(usable) == 1 else self._merge_parsed(usable)
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
