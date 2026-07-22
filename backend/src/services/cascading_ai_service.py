"""
cascading_ai_service.py — Vault V2
====================================
FAITHFUL PDF EXTRACTION — Never fabricates, never generates content that isn't in the PDF.

Key changes from V1:
- Extraction prompt instructs AI to extract EXACTLY what's in the document
- Prices come from the PDF, not from budget calculations
- Currency auto-detected from PDF text (₹ = INR, $ = USD, € = EUR, £ = GBP)
- Returns a single parsed package per PDF (not "3 recommendations")
- Removed ALL hardcoded fallback content (fake hotel names, fabricated prices, generic descriptions)
- Budget-match logic moved to vault_knowledge_service.list_vault_packages()
"""

import os
import re
import json
import hashlib
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CURRENCY DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def detect_currency_from_text(text: str) -> str:
    """
    Detect the primary currency used in the PDF text.
    Returns ISO 4217 code (INR, USD, EUR, GBP, AED, etc.)
    Defaults to INR (India-first product).
    """
    text_lower = text.lower()
    # Count occurrences to find dominant currency
    scores = {
        "INR": 0, "USD": 0, "EUR": 0, "GBP": 0,
        "AED": 0, "SGD": 0, "THB": 0, "JPY": 0,
    }

    # Indian Rupee patterns
    inr_matches = len(re.findall(r'(?:₹|rs\.?|inr|rupee)', text_lower))
    scores["INR"] = inr_matches * 3  # Weight INR higher (India-first)

    # USD patterns
    usd_matches = len(re.findall(r'(?:\$\s*\d|\busd\b|\bu\.s\.\s*dollar)', text_lower))
    scores["USD"] = usd_matches

    # EUR patterns
    eur_matches = len(re.findall(r'(?:€|euro|\beur\b)', text_lower))
    scores["EUR"] = eur_matches

    # GBP patterns
    gbp_matches = len(re.findall(r'(?:£|\bgbp\b|\bpound)', text_lower))
    scores["GBP"] = gbp_matches

    # AED (UAE Dirham)
    aed_matches = len(re.findall(r'(?:\baed\b|dirham)', text_lower))
    scores["AED"] = aed_matches

    # Return currency with highest score; default INR
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "INR"


# ─────────────────────────────────────────────────────────────────────────────
# FAITHFUL EXTRACTION PROMPT
# ─────────────────────────────────────────────────────────────────────────────

EXTRACTION_PROMPT_TEMPLATE = """You are an expert travel document parser. Your ONLY job is to extract structured data from the travel itinerary text below.

CRITICAL RULES — VIOLATING THESE IS UNACCEPTABLE:
1. Extract ONLY what is explicitly written in the document. Do NOT invent, generate, or hallucinate ANY content.
2. Preserve exact hotel names, exact activity names, exact meal venue names — word for word.
3. Prices MUST come directly from the document. If a document says "₹41,000" extract {{price: 41000, currency: "INR"}}. Never calculate prices from percentages.
4. If a price is not mentioned for an item, set it to null — NEVER make up a number.
5. If a timing is mentioned (e.g. "09:00 AM Transfer"), preserve it in the "timing" field.
6. Extract the FULL overview/introduction text from the first page verbatim.
7. Extract every day exactly as described — day number, title, full description text, sub-destination.
8. For each day extract: every hotel (name, category, exact price, location), every activity (name, timing, price, duration, full description), every transfer (type, vehicle, from, to, timing, price), every meal (type, venue name, cuisine, price).
9. Extract ALL sections at the end of the document — Inclusions, Exclusions, What to Pack, Visa Guidelines, Important Notes, Do's and Don'ts, Cancellation Policy, Damages, Terms & Conditions. Whatever sections exist, extract them all.
10. Detect currency from the document — look for ₹, Rs, INR, $, USD, €, EUR, £, GBP, AED, etc. Return ISO 4217 code.
11. If something is not mentioned, set it to null — never fabricate.
12. HOTEL DETAILS TABLE (CRITICAL): Many supplier PDFs contain a summary table near the end listing hotels, total nights, and meal plans (e.g. Destination | Hotels | Total Nights | Meal Plan). You MUST extract this table into the top-level "hotels" array AND map each row to the correct day's hotels in the "days" array based on destination/location. Map fields: destination -> location, hotel name/options -> name, nights/total nights -> price_per_night / notes context, meal plan -> meal_plan.
13. If you see page boundary markers like "[Page N]", treat them as layout indicators and extract all content before and after them.

The document language is English only.

Return ONLY a valid JSON object with this exact schema — no markdown, no code blocks, just raw JSON:
{{
  "destination": "primary destination name",
  "sub_destinations": ["list of sub-destinations mentioned"],
  "overview": "full verbatim overview/introduction from page 1",
  "duration_days": N,
  "currency": "INR",
  "total_price": N or null,
  "price_per_person": N or null,
  "hotels": [
    {{
      "name": "exact hotel name",
      "category": "star rating or type",
      "price_per_night": N or null,
      "location": "location/destination",
      "meal_plan": "e.g. CP/MAP/AP",
      "inclusions": ["list of inclusions if mentioned"],
      "image_url": ""
    }}
  ],
  "days": [
    {{
      "day_number": 1,
      "title": "exact title",
      "description": "full description text verbatim",
      "sub_destination": "city/area for this day",
      "schedule": "any timing info mentioned for the day",
      "hotels": [
        {{
          "name": "exact hotel name",
          "category": "star rating or type",
          "price_per_night": N or null,
          "location": "location",
          "meal_plan": "e.g. CP/MAP/AP",
          "inclusions": ["list of inclusions if mentioned"],
          "image_url": ""
        }}
      ],
      "activities": [
        {{
          "name": "exact activity name",
          "duration": "e.g. 2 hours",
          "timing": "e.g. 10:00 AM",
          "price": N or null,
          "location": "location",
          "description": "full description",
          "image_url": ""
        }}
      ],
      "transfers": [
        {{
          "type": "e.g. Airport Transfer, Sightseeing",
          "vehicle": "e.g. Innova Crysta, Tempo Traveller",
          "from": "origin",
          "to": "destination",
          "timing": "e.g. 06:00 AM",
          "price": N or null,
          "notes": "any additional notes"
        }}
      ],
      "meals": [
        {{
          "type": "Breakfast/Lunch/Dinner/Snacks",
          "venue": "restaurant or hotel name",
          "cuisine": "type of cuisine",
          "price": N or null,
          "notes": "any special notes",
          "image_url": ""
        }}
      ]
    }}
  ],
  "inclusions": ["exact list of inclusions verbatim from document"],
  "exclusions": ["exact list of exclusions verbatim from document"],
  "extra_sections": {{
    "what_to_pack": "verbatim content or essentials if present, else null",
    "visa_guidelines": "verbatim content if present, else null",
    "important_notes": "verbatim content if present, else null",
    "damages": "verbatim content if present, else null",
    "cancellation_policy": "verbatim content if present, else null",
    "dos_and_donts": "verbatim content if present, else null",
    "payment": "verbatim payment terms, 50% advance deposit notes, etc. if present, else null",
    "terms_and_conditions": "verbatim terms & condition section if present, else null",
    "amendment": "verbatim amendment policy if present, else null",
    "refund": "verbatim refund policy if present, else null",
    "about_transport": "verbatim vehicle / transport notes (e.g. Tawang rules) if present, else null",
    "arrival_requirements": "verbatim arrival particulars / ID proofs required if present, else null",
    "ANY_OTHER_HEADING_IN_PDF": "If the PDF contains any other custom sections or headings at the end, add them here verbatim using a lowercase_snake_case key"
  }}
}}

DOCUMENT TEXT TO PARSE:
{document_text}"""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXTRACTION FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

async def extract_vault_package_from_text(
    full_text: str,
    destination_hint: str = "",
    images: Optional[List[Dict[str, Any]]] = None,
    agency_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract a structured vault package from PDF text using Instructor + strict Pydantic schema orchestration.
    This is the ONLY place AI is called for vault processing.
    
    Returns a structured JSON matching the extraction schema above.
    Raises an exception if extraction fails — NO fake fallback.
    """
    from src.services.ai_client import call_llm

    # Detect currency from the raw text BEFORE sending to AI
    detected_currency = detect_currency_from_text(full_text)
    logger.info(f"[VaultExtract] Detected currency: {detected_currency}")

    # 1. Attempt strict AI Orchestration via Instructor & FinalProposalSchema
    parsed: Dict[str, Any] = {}
    try:
        from src.services.ai_orchestration_service import orchestrate_proposal_extraction
        logger.info("[VaultExtract] Orchestrating proposal extraction via Instructor & strict Pydantic schema...")
        proposal_model = await orchestrate_proposal_extraction(
            extraction_input=full_text,
            destination_hint=destination_hint,
            agency_id=agency_id
        )
        parsed = proposal_model.model_dump(by_alias=True)
        parsed["model_used"] = getattr(proposal_model, "model_used", "gemini-2.5-flash")
    except Exception as orch_err:
        if isinstance(orch_err, RuntimeError) or "Neither GEMINI_API_KEY" in str(orch_err):
            raise orch_err
        logger.warning(f"[VaultExtract] Instructor orchestration encountered issue ({orch_err}); falling back to standard call_llm flow.")
        # Build prompt with full document text (Gemini 2.5 Flash has 1M token context)
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(document_text=full_text)

        cache_meta = {
            "agency_id": agency_id,
            "entity_type": "vault_package",
            "prompt_version": "extraction_v2.0.0",
            "schema_version": "schema_v2.0.0",
            "model": "gemini-2.5-flash",
            "input_text": full_text
        }

        logger.info("[VaultExtract] Sending to LLM via call_llm for faithful extraction...")
        content = await call_llm(
            prompt=prompt,
            provider="gemini",
            response_schema={"type": "object"},
            temperature=0.0,
            max_tokens=65536,
            cache_meta=cache_meta
        )

        import json_repair
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            try:
                repaired = json_repair.loads(content)
                if isinstance(repaired, dict):
                    parsed = repaired
                else:
                    json_match = re.search(r'\{[\s\S]+\}', content)
                    if json_match:
                        parsed = json_repair.loads(json_match.group())
                    else:
                        raise ValueError(f"Gemini returned non-dict structure after repair: {type(repaired)}")
            except Exception as repair_err:
                raise ValueError(f"Gemini returned invalid JSON ({e}); repair failed: {repair_err}\nResponse preview: {content[:500]}")

        # Apply detected currency if AI missed it or defaulted to USD
        if parsed.get("currency", "USD") == "USD" and detected_currency != "USD":
            logger.info(f"[VaultExtract] Correcting currency from USD to {detected_currency}")
            parsed["currency"] = detected_currency

        # Use destination hint if AI didn't extract a destination
        if not parsed.get("destination") and destination_hint:
            parsed["destination"] = destination_hint

        parsed["model_used"] = cache_meta.get("model_used", "gemini-2.5-flash")

    # Attach cover image (first extracted image from PDF page 1)
    if images and len(images) > 0:
        parsed["cover_image_url"] = images[0].get("url", "")
        # Assign images to day activities/hotels where image_url is empty
        img_idx = 1
        for day in (parsed.get("days") or []):
            for hotel in (day.get("hotels") or []):
                if not hotel.get("image_url") and img_idx < len(images):
                    hotel["image_url"] = images[img_idx]["url"]
                    img_idx += 1
            for activity in (day.get("activities") or []):
                if not activity.get("image_url") and img_idx < len(images):
                    activity["image_url"] = images[img_idx]["url"]
                    img_idx += 1
            for meal in (day.get("meals") or []):
                if not meal.get("image_url") and img_idx < len(images):
                    meal["image_url"] = images[img_idx]["url"]
                    img_idx += 1

    # Clean up null extra_sections and enhance with deterministic pure-code extraction
    if isinstance(parsed.get("extra_sections"), dict):
        extra = parsed.get("extra_sections") or {}
        parsed["extra_sections"] = {k: v for k, v in extra.items() if v and isinstance(v, str) and v.strip()}
    else:
        parsed["extra_sections"] = {}

    # Pure-code multi-reader pipeline enhancement (Rule 5 compliance)
    pure_extra = _extract_sections_pure_code(full_text)
    for k, v in pure_extra.items():
        if not parsed["extra_sections"].get(k):
            parsed["extra_sections"][k] = v

    pure_days = _extract_days_pure_code(full_text)
    current_days = parsed.get("days", []) or []
    if len(pure_days) > len(current_days):
        if len(current_days) == 0:
            parsed["days"] = pure_days
        else:
            existing_nums = {d.get("day_number") for d in current_days if isinstance(d, dict) and d.get("day_number") is not None}
            for pd in pure_days:
                if pd.get("day_number") not in existing_nums:
                    current_days.append(pd)
                    existing_nums.add(pd.get("day_number"))
            current_days.sort(key=lambda x: x.get("day_number", 0) if isinstance(x, dict) else 0)
            parsed["days"] = current_days
    if parsed.get("days") and len(parsed["days"]) > 0:
        parsed["duration_days"] = max(parsed.get("duration_days", 1), len(parsed["days"]))

    # Expand slash-separated hotels and merge pure-code hotel extractions
    expanded_hotels = []
    for h in (parsed.get("hotels") or []):
        if not isinstance(h, dict):
            continue
        h_name = str(h.get("name") or "").strip()
        if "/" in h_name and len(h_name.split("/")) >= 2:
            parts = [p.strip() for p in h_name.split("/") if len(p.strip()) >= 3]
            for p in parts:
                new_h = dict(h)
                new_h["name"] = p
                expanded_hotels.append(new_h)
        else:
            expanded_hotels.append(h)

    for d in (parsed.get("days") or []):
        if not isinstance(d, dict):
            continue
        day_hotels = []
        for h in (d.get("hotels") or []):
            if not isinstance(h, dict):
                continue
            h_name = str(h.get("name") or "").strip()
            if "/" in h_name and len(h_name.split("/")) >= 2:
                parts = [p.strip() for p in h_name.split("/") if len(p.strip()) >= 3]
                for p in parts:
                    new_h = dict(h)
                    new_h["name"] = p
                    day_hotels.append(new_h)
            else:
                day_hotels.append(h)
        d["hotels"] = day_hotels

    pure_hotels = _extract_hotels_pure_code(full_text)
    existing_h_names = {str(x.get("name") or "").strip().lower() for x in expanded_hotels if isinstance(x, dict)}
    for ph in pure_hotels:
        ph_name = str(ph.get("name") or "").strip().lower()
        if ph_name and ph_name not in existing_h_names:
            expanded_hotels.append(ph)
            existing_h_names.add(ph_name)
    parsed["hotels"] = expanded_hotels

    logger.info(
        f"[VaultExtract] Extraction complete — destination={parsed.get('destination')}, "
        f"days={len(parsed.get('days', []))}, currency={parsed.get('currency')}, "
        f"hotels={len(parsed.get('hotels', []))}, extra_sections={list(parsed.get('extra_sections', {}).keys())}"
    )

    return parsed


def _extract_sections_pure_code(text: str) -> Dict[str, str]:
    """
    Deterministic pure-code section extraction.
    Scans text for common extra section headings and captures paragraphs verbatim.
    Ensures zero-miss capture when AI drops optional sections.
    """
    if not text:
        return {}

    headings = [
        (r"(?i)\b(?:payment\s+terms|terms\s+of\s+payment|advance\s+deposit|bank\s+details|account\s+details|payment\s+policy)\b", "payment"),
        (r"(?i)\b(?:cancellation\s+policy|cancellation\s+charges|cancellation\s+terms)\b", "cancellation_policy"),
        (r"(?i)\b(?:what\s+to\s+pack|things\s+to\s+carry|packing\s+list|packing\s+essentials)\b", "what_to_pack"),
        (r"(?i)\b(?:visa\s+guidelines|visa\s+information|visa\s+requirements|visa\s+info)\b", "visa_guidelines"),
        (r"(?i)\b(?:important\s+notes|important\s+remarks|please\s+note|general\s+notes)\b", "important_notes"),
        (r"(?i)\b(?:terms\s+and\s+conditions|terms\s+&\s+conditions|general\s+terms)\b", "terms_and_conditions"),
        (r"(?i)\b(?:dos\s+and\s+donts|do's\s+and\s+don'ts|do's\s+&\s+don'ts|guidelines)\b", "dos_and_donts"),
        (r"(?i)\b(?:office\s+address|contact\s+us|our\s+address|branch\s+office)\b", "office_address"),
        (r"(?i)\b(?:about\s+transport|transport\s+rules|vehicle\s+notes|local\s+taxi)\b", "about_transport"),
        (r"(?i)\b(?:arrival\s+requirements|id\s+proof|documents\s+required)\b", "arrival_requirements"),
        (r"(?i)\b(?:damages|liability\s+policy)\b", "damages"),
        (r"(?i)\b(?:amendment\s+policy|rescheduling\s+policy)\b", "amendment"),
        (r"(?i)\b(?:refund\s+policy)\b", "refund")
    ]

    lines = text.split("\n")
    sections: Dict[str, List[str]] = {}
    current_key = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_key and sections[current_key] and sections[current_key][-1] != "\n":
                sections[current_key].append("\n")
            continue

        found_heading = False
        if len(stripped) < 80:
            for pattern, key in headings:
                if re.search(pattern, stripped):
                    current_key = key
                    if current_key not in sections:
                        sections[current_key] = [stripped]
                    found_heading = True
                    break

        if not found_heading and current_key:
            if len("\n".join(sections[current_key])) < 3000:
                sections[current_key].append(stripped)

    result = {}
    for k, lines_list in sections.items():
        content = "\n".join(lines_list).strip()
        if len(content) > 10:
            result[k] = content
    return result


def _extract_days_pure_code(text: str) -> List[Dict[str, Any]]:
    """
    Deterministic pure-code day extraction.
    Ensures itinerary days are extracted when AI truncates or misses days.
    """
    if not text:
        return []

    pattern = re.compile(r"(?i)(?:^|\n)\s*(?:Day|DAY)\s*([0-9]+)\s*[:\-–.]?\s*([^\n]+)?")
    matches = list(pattern.finditer(text))
    if not matches:
        return []

    days = []
    for i, m in enumerate(matches):
        try:
            day_num = int(m.group(1))
        except ValueError:
            continue
        title_part = (m.group(2) or f"Day {day_num}").strip()
        start_idx = m.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        desc_chunk = text[start_idx:end_idx].strip()

        # Clean up description text if it gets too large
        if len(desc_chunk) > 2000:
            desc_chunk = desc_chunk[:2000] + "..."

        days.append({
            "day_number": day_num,
            "title": title_part or f"Day {day_num}",
            "description": desc_chunk or "Itinerary details as outlined in document.",
            "sub_destination": "",
            "schedule": "",
            "hotels": [],
            "activities": [],
            "transfers": [],
            "meals": []
        })

    return days


# ─────────────────────────────────────────────────────────────────────────────
# LEGACY COMPATIBILITY — route_model_cascading
# Still called by pdf_router.py for the /vault-process endpoint.
# Now wraps extract_vault_package_from_text.
# ─────────────────────────────────────────────────────────────────────────────

async def route_model_cascading(
    compressed_text: str,
    images: List[Dict[str, Any]],
    destination: str,
    budget: float,
    duration: int,
    currency: str = "INR",
    agency_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Backward-compatible wrapper.
    Calls the new faithful extraction function and returns in a format
    compatible with the existing pdf_router.py response structure.
    """
    try:
        extracted = await extract_vault_package_from_text(
            full_text=compressed_text,
            destination_hint=destination,
            images=images,
            agency_id=agency_id,
        )
        model_used = extracted.get("model_used", "gemini-2.5-flash")
        return {
            "success": True,
            "extracted_package": extracted,
            # Maintain some backward compat fields that frontend may read
            "recommendations": [_package_to_legacy_recommendation(extracted)],
            "model_used": f"{model_used} (faithful-extraction)",
            "detected_destination": extracted.get("destination") or destination,
            "sub_destinations": extracted.get("sub_destinations", []),
            "what_to_pack": (extracted.get("extra_sections") or {}).get("what_to_pack", ""),
            "extra_sections": extracted.get("extra_sections", {}),
            "custom_fields": _build_custom_fields(extracted.get("extra_sections", {})),
            "currency": extracted.get("currency", "INR"),
            "total_price": extracted.get("total_price"),
        }
    except Exception as e:
        logger.exception(f"[VaultExtract] Extraction failed: {e}")
        # Return a proper error — no fake fallback data
        raise


def _package_to_legacy_recommendation(pkg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts a faithfully-extracted package into the legacy recommendation
    format that MyVaultPage.jsx currently expects.
    """
    return {
        "option_id": f"vault_extracted_{pkg.get('destination', 'unknown').lower().replace(' ', '_')}",
        "option_title": pkg.get("destination", "Extracted Itinerary"),
        "destination": pkg.get("destination", ""),
        "sub_destinations": pkg.get("sub_destinations", []),
        "duration_days": pkg.get("duration_days", 1),
        "target_budget": pkg.get("total_price"),
        "total_estimated_cost": pkg.get("total_price"),
        "cost_variance_percentage": "Actual (from PDF)",
        "currency": pkg.get("currency", "INR"),
        "status": "Extracted",
        "overview": pkg.get("overview", ""),
        "cover_image_url": pkg.get("cover_image_url", ""),
        "days": pkg.get("days", []),
        "inclusions": pkg.get("inclusions", []),
        "exclusions": pkg.get("exclusions", []),
        "extra_sections": pkg.get("extra_sections", {}),
        "what_to_pack": (pkg.get("extra_sections") or {}).get("what_to_pack", ""),
    }


def _build_custom_fields(extra_sections: Dict[str, str]) -> List[Dict[str, Any]]:
    """Convert extra_sections dict to custom_fields array for branding step."""
    import uuid as _uuid
    fields = []
    for sec_type, content in (extra_sections or {}).items():
        if not content:
            continue
        title = sec_type.replace("_", " ").title()
        fields.append({
            "id": f"extracted_{sec_type}_{_uuid.uuid4().hex[:6]}",
            "label": title,
            "value": content,
            "type": "checklist" if "pack" in sec_type else "text",
            "section_type": sec_type,
        })
    return fields
