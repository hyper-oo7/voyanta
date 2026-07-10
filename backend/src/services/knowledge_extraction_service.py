import os
import json
import logging
from typing import List, Dict, Any, Optional
from src.services.ai_service import call_gemini_with_retry
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

VALID_OBJECT_TYPES = {'destination', 'hotel', 'activity', 'restaurant', 'transfer', 'visa_note', 'seasonal_rule'}

# Taxonomy configuration
VALID_TAGS = {
    "audience": {"family", "couple", "honeymoon", "solo", "group", "kids", "senior"},
    "pace": {"relaxed", "moderate", "packed"},
    "setting": {"indoor", "outdoor", "mixed"},
    "price_tier": {"budget", "mid", "luxury"},
    "season": {"best-in-monsoon", "best-in-winter", "best-in-summer", "avoid-in-monsoon"},
    "duration": {"half-day", "full-day", "multi-day"}
}

SYSTEM_PROMPT = (
    "You are an expert travel coordinator. Parse the following travel itinerary or supplier contract text and extract atomic travel components/entities.\n"
    "Extract any of the following object types:\n"
    "1. 'destination': A city or country mentioned as a main destination. Attributes can include country, best_season, tags.\n"
    "2. 'hotel': Any accommodation, hotel, or resort. Attributes can include star_rating, price_range, amenities, room_types.\n"
    "3. 'activity': A tour, sight-seeing event, entry ticket, or excursion. Attributes can include duration, price, category.\n"
    "4. 'restaurant': Dining venues. Attributes can include cuisine, price_level.\n"
    "5. 'transfer': Airport transfers, coach rides, private cars. Attributes can include vehicle_class, duration.\n"
    "6. 'visa_note': Visa guidelines or visa policy summaries. Attributes can include processing_time, fee, required_docs.\n"
    "7. 'seasonal_rule': Any seasonal travel advisory, warning, or peak/off-season preference mentioned for a destination. Attributes MUST include month (1-12), rule_type ('avoid', 'prefer', or 'warn'), applies_to_tag (e.g., 'outdoor', 'water sports', or null), and message (explanatory warning text).\n\n"
    "For each item, return a JSON object with:\n"
    "- \"object_type\": Must be exactly one of: 'destination', 'hotel', 'activity', 'restaurant', 'transfer', 'visa_note', 'seasonal_rule'\n"
    "- \"name\": The official/formal name of the hotel, activity, destination, etc.\n"
    "- \"destination\": The name of the city or general destination (e.g. \"Dubai\") where this object is located.\n"
    "- \"area\": The specific region or neighborhood if mentioned (e.g. \"Dubai Marina\"), otherwise null.\n"
    "- \"attributes\": A key-value dictionary with whatever fields are relevant to that type.\n"
    "- \"tags\": An array of objects classifying the component against our taxonomy. Each tag object must have:\n"
    "  * \"tag_category\": Must be exactly one of: 'audience', 'pace', 'setting', 'price_tier', 'season', 'duration'\n"
    "  * \"tag\": Must be exactly one of the allowed tags for that category:\n"
    "    - audience: family, couple, honeymoon, solo, group, kids, senior\n"
    "    - pace: relaxed, moderate, packed\n"
    "    - setting: indoor, outdoor, mixed\n"
    "    - price_tier: budget, mid, luxury\n"
    "    - season: best-in-monsoon, best-in-winter, best-in-summer, avoid-in-monsoon\n"
    "    - duration: half-day, full-day, multi-day\n"
    "  Only include tags that clearly apply. Do not invent categories or tags outside this list.\n"
    "- \"rates\": If the source text contains specific supplier rate or pricing details for hotels or activities, extract them as an array of objects. Each rate object must have:\n"
    "  * \"supplier_name\": The name of the supplier (e.g. \"TBO Holidays\", \"Desiya\").\n"
    "  * \"rate\": A numeric price (e.g. 15000 or 150.50).\n"
    "  * \"currency\": The currency code (e.g. \"INR\", \"USD\", default \"INR\").\n"
    "  * \"valid_from\": The start date of the rate in \"YYYY-MM-DD\" format, or null.\n"
    "  * \"valid_to\": The end date of the rate in \"YYYY-MM-DD\" format, or null.\n\n"
    "Output MUST be a valid JSON array of these objects and nothing else. Do not output any markdown code block formatting (like ```json), commentary, or headers. Return ONLY the raw valid JSON array."
)

def _defensive_json_parse(text: str) -> Optional[List[Dict[str, Any]]]:
    """Cleans up markdown code blocks and attempts parsing."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1:
            cleaned = cleaned[start:end+1]
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            for val in data.values():
                if isinstance(val, list):
                    return val
            return [data]
    except Exception as e:
        logger.debug(f"[KnowledgeExtract] Initial parse failed: {e}")
    return None

async def extract_knowledge_objects(text: str) -> List[Dict[str, Any]]:
    """
    Sends raw text to Gemini and extracts atomic travel components with tag metadata.
    Retries once with a stricter prompt on JSON parse failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("[KnowledgeExtract] GEMINI_API_KEY not configured — skipping knowledge extraction.")
        return []

    payload = {
        "contents": [{"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\nInput Text:\n{text}"}]}],
        "generationConfig": {"temperature": 0.2}
    }
    
    try:
        res = await call_gemini_with_retry(payload, api_key)
        raw_text = res["candidates"][0]["content"]["parts"][0]["text"]
        parsed = _defensive_json_parse(raw_text)
        
        if parsed is not None:
            return parsed
            
        logger.warning("[KnowledgeExtract] Parsing failed. Retrying with a stricter format prompt...")
        payload_retry = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\nInput Text:\n{text}"}]},
                {"role": "model", "parts": [{"text": raw_text}]},
                {"role": "user", "parts": [{"text": "The response failed to parse as valid JSON. Ensure you return ONLY a raw JSON array of objects without any markdown code fences, prose, or outer wrappers. Check all double-quotes, commas and braces."}]}
            ],
            "generationConfig": {"temperature": 0.1}
        }
        res_retry = await call_gemini_with_retry(payload_retry, api_key)
        raw_text_retry = res_retry["candidates"][0]["content"]["parts"][0]["text"]
        parsed_retry = _defensive_json_parse(raw_text_retry)
        
        if parsed_retry is not None:
            return parsed_retry
            
    except Exception as e:
        logger.exception("Gemini knowledge extraction call failed")
        
    return []

def save_knowledge_objects(
    objects: List[Dict[str, Any]],
    agency_id: Optional[str] = None,
    source_pdf_id: Optional[str] = None
) -> int:
    """
    Saves a list of parsed atomic objects to public.knowledge_objects table
    and validates and inserts matching tag categories into public.object_tags.
    """
    sb = get_supabase_client()
    if not sb:
        logger.warning("[KnowledgeExtract] No Supabase client — cannot save knowledge objects.")
        return 0

    inserted_count = 0
    records_to_insert = []
    
    for obj in objects:
        if not isinstance(obj, dict):
            continue
            
        obj_type = obj.get("object_type")
        if obj_type not in VALID_OBJECT_TYPES:
            if obj_type and obj_type.rstrip('s') in VALID_OBJECT_TYPES:
                obj_type = obj_type.rstrip('s')
            else:
                logger.warning(f"[KnowledgeExtract] Skipping object with invalid type: {obj_type}")
                continue

        if obj_type == "seasonal_rule":
            dest = obj.get("destination") or obj.get("name")
            attrs = obj.get("attributes") or {}
            month_val = attrs.get("month")
            r_type = attrs.get("rule_type")
            message = attrs.get("message") or obj.get("name")
            applies_to = attrs.get("applies_to_tag")
            
            try:
                month_val = int(month_val)
            except (ValueError, TypeError):
                month_val = None
                
            if dest and month_val in range(1, 13) and r_type in ('avoid', 'prefer', 'warn'):
                rule_rec = {
                    "destination": dest,
                    "month": month_val,
                    "rule_type": r_type,
                    "applies_to_tag": applies_to,
                    "message": message
                }
                if agency_id:
                    rule_rec["agency_id"] = agency_id
                if source_pdf_id:
                    rule_rec["source_pdf_id"] = source_pdf_id
                    
                try:
                    sb.table("seasonal_rules").insert(rule_rec).execute()
                    logger.info(f"[KnowledgeExtract] Saved extracted seasonal rule for {dest} in month {month_val}")
                except Exception as ex_rule:
                    logger.error(f"[KnowledgeExtract] Failed to save extracted seasonal rule: {ex_rule}")
            continue

        name = obj.get("name")
        if not name:
            continue

        record = {
            "object_type": obj_type,
            "name": name,
            "destination": obj.get("destination"),
            "area": obj.get("area"),
            "attributes": obj.get("attributes") or {},
            "is_active": True
        }
        
        if agency_id:
            record["agency_id"] = agency_id
        if source_pdf_id:
            record["source_pdf_id"] = source_pdf_id
            
        records_to_insert.append(record)

    if records_to_insert:
        try:
            # Batch insert knowledge objects
            res = sb.table("knowledge_objects").insert(records_to_insert).execute()
            if res.data:
                inserted_count = len(res.data)
                logger.info(f"[KnowledgeExtract] Successfully inserted {inserted_count} atomic objects.")
                
                # Match inserted objects by (name, object_type) to find their new IDs
                inserted_map = {(r["name"], r["object_type"]): r["id"] for r in res.data}
                
                # Build list of validated tags
                tag_records = []
                for obj in objects:
                    if not isinstance(obj, dict):
                        continue
                    obj_id = inserted_map.get((obj.get("name"), obj.get("object_type")))
                    if not obj_id:
                        continue
                    
                    # Process and validate tags
                    tags_list = obj.get("tags") or []
                    for tag_item in tags_list:
                        if not isinstance(tag_item, dict):
                            continue
                        cat = tag_item.get("tag_category")
                        tag_val = tag_item.get("tag")
                        
                        # Validate category and value against our fixed taxonomy
                        if cat in VALID_TAGS and tag_val in VALID_TAGS[cat]:
                            tag_records.append({
                                "object_id": obj_id,
                                "tag_category": cat,
                                "tag": tag_val
                            })
                        else:
                            logger.debug(f"[KnowledgeExtract] Dropping invalid tag: category={cat}, tag={tag_val}")
                
                # Batch upsert tags
                if tag_records:
                    try:
                        sb.table("object_tags").upsert(tag_records, on_conflict="object_id,tag").execute()
                        logger.info(f"[KnowledgeExtract] Inserted {len(tag_records)} tags for knowledge objects.")
                    except Exception as tag_err:
                        logger.error(f"[KnowledgeExtract] Failed to insert object tags: {tag_err}")

                # Build list of supplier rates
                rate_records = []
                for obj in objects:
                    if not isinstance(obj, dict):
                        continue
                    obj_id = inserted_map.get((obj.get("name"), obj.get("object_type")))
                    if not obj_id:
                        continue
                    
                    rates_list = obj.get("rates") or []
                    for rate_item in rates_list:
                        if not isinstance(rate_item, dict):
                            continue
                        
                        supplier_name = rate_item.get("supplier_name")
                        try:
                            rate_val = float(rate_item.get("rate") or 0)
                        except (ValueError, TypeError):
                            continue
                            
                        if not supplier_name or rate_val <= 0:
                            continue
                            
                        rate_rec = {
                            "knowledge_object_id": obj_id,
                            "supplier_name": supplier_name,
                            "rate": rate_val,
                            "currency": rate_item.get("currency") or "INR",
                            "valid_from": rate_item.get("valid_from") or None,
                            "valid_to": rate_item.get("valid_to") or None
                        }
                        
                        if agency_id:
                            rate_rec["agency_id"] = agency_id
                        if source_pdf_id:
                            rate_rec["source_pdf_id"] = source_pdf_id
                            
                        rate_records.append(rate_rec)
                        
                # Batch insert supplier rates
                if rate_records:
                    try:
                        sb.table("supplier_rates").insert(rate_records).execute()
                        logger.info(f"[KnowledgeExtract] Inserted {len(rate_records)} supplier rates.")
                    except Exception as rate_err:
                        logger.error(f"[KnowledgeExtract] Failed to insert supplier rates: {rate_err}")
                        
        except Exception as e:
            logger.error(f"[KnowledgeExtract] Failed to insert knowledge records: {e}")

    return inserted_count
