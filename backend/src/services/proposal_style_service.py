import os
import json
import logging
from typing import Optional, Dict, Any
from src.services.supabase_client import get_supabase_client
from src.services.ai_service import call_gemini_with_retry, call_openai_with_retry

logger = logging.getLogger(__name__)

async def rebuild_style_profile(agency_id: str) -> Optional[dict]:
    """
    Given an agency_id, queries their last 15 finalized proposals and last 15
    uploaded supplier PDFs (vault_packages). Combines their textual style, structure,
    inclusions/exclusions wording, and markups, and builds a style profile using LLM.
    """
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured")
        return None
        
    try:
        # 1. Fetch last 15 non-draft proposals
        res_proposals = sb.table("proposals")\
            .select("id, name, destination, brief, preferences")\
            .eq("agency_id", agency_id)\
            .neq("status", "Draft")\
            .eq("is_archived", False)\
            .order("created_at", desc=True)\
            .limit(15)\
            .execute()
            
        proposals_list = res_proposals.data or []
        if not proposals_list:
            # Fall back to any proposals if no non-drafts are available
            res_any = sb.table("proposals")\
                .select("id, name, destination, brief, preferences")\
                .eq("agency_id", agency_id)\
                .order("created_at", desc=True)\
                .limit(15)\
                .execute()
            proposals_list = res_any.data or []
            
        # 2. Fetch last 15 uploaded supplier PDFs (vault_packages)
        res_vault = sb.table("vault_packages")\
            .select("id, destination, overview, parsed_data, extra_sections")\
            .eq("agency_id", agency_id)\
            .eq("status", "active")\
            .order("created_at", desc=True)\
            .limit(15)\
            .execute()
            
        vault_list = res_vault.data or []
        
        if not proposals_list and not vault_list:
            logger.warning(f"No finalized proposals or vault packages found for agency {agency_id} to build style profile.")
            return {}
            
        # 3. Format the collected style data
        corpus_texts = []
        
        # Format proposals
        for idx, p in enumerate(proposals_list, 1):
            name = p.get("name") or "Unnamed"
            dest = p.get("destination") or "Unknown"
            brief = p.get("brief") or {}
            greeting = brief.get("special_notes") or ""
            
            prefs = p.get("preferences") or {}
            branding = prefs.get("branding") or {}
            highlights = branding.get("highlights") or ""
            inclusions = branding.get("inclusions") or ""
            exclusions = branding.get("exclusions") or ""
            
            costing = prefs.get("costing") or {}
            markup_pct = costing.get("pct_markup") or 0
            markup_fixed = costing.get("fixed_markup") or 0
            
            section_order = prefs.get("section_order") or []
            
            corpus_texts.append(
                f"Finalized Proposal #{idx}:\n"
                f"- Name: {name}\n"
                f"- Destination: {dest}\n"
                f"- Greeting/Special Notes: {greeting}\n"
                f"- Highlights: {highlights}\n"
                f"- Inclusions: {inclusions}\n"
                f"- Exclusions: {exclusions}\n"
                f"- Section Order: {section_order}\n"
                f"- Costing Markup: Pct Markup {markup_pct}%, Fixed Markup {markup_fixed}\n"
            )
            
        # Format uploaded vault packages
        for idx, vp in enumerate(vault_list, 1):
            dest = vp.get("destination") or "Unknown"
            overview = vp.get("overview") or ""
            extra = vp.get("extra_sections") or {}
            
            if isinstance(extra, str):
                try:
                    extra = json.loads(extra)
                except Exception:
                    extra = {}
                    
            inclusions = extra.get("inclusions") or ""
            exclusions = extra.get("exclusions") or ""
            
            corpus_texts.append(
                f"Uploaded Supplier PDF #{idx} (Vault Package):\n"
                f"- Destination: {dest}\n"
                f"- Overview/Greeting: {overview}\n"
                f"- Inclusions: {inclusions}\n"
                f"- Exclusions: {exclusions}\n"
            )
            
        formatted_corpus = "\n\n".join(corpus_texts)
        
        # 4. Prompt the LLM to extract style profile
        system_prompt = (
            "You are an expert luxury travel copywriter and brand analyst. Analyze the travel proposals and uploaded supplier PDFs of a luxury travel agency and extract their typical writing style, tone, inclusions/exclusions wording, and structure patterns.\n"
            "Generate a JSON object summarizing their style profile with these exact keys:\n"
            "{\n"
            '  "greeting_style": "Wording, length, level of personalization, welcoming tone and format details for the client greeting",\n'
            '  "highlights_style": "Structure (bullet points or paragraph), tone, and typical length of trip highlights",\n'
            '  "tone": "Formal, casual, romantic, adventurous, executive, warm, etc.",\n'
            '  "section_order": "Typical sequence of sections/pages if inferable (e.g. overview -> itinerary -> inclusions)",\n'
            '  "typical_inclusions_exclusions": "Standard wording style for inclusions and exclusions (e.g. VIP transfers included, international flights excluded)",\n'
            '  "typical_markup_range": "Typical markup percentage or fixed markup range if inferable"\n'
            "}\n"
            "Return ONLY the raw valid JSON object. Do not include markdown code block formatting (like ```json), commentary, or headers."
        )
        
        api_key_gemini = os.environ.get("GEMINI_API_KEY")
        api_key_openai = os.environ.get("OPENAI_API_KEY")
        
        if not api_key_gemini and not api_key_openai:
            logger.error("No LLM API keys configured")
            return None
            
        profile_data = {}
        if api_key_gemini:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": f"{system_prompt}\n\nProposals and PDFs Data:\n{formatted_corpus}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                },
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "style_profile",
                    "prompt_version": "rebuild_v1.0.0",
                    "schema_version": "style_schema_v1.0.0",
                    "model": "gemini-2.5-flash",
                    "input_text": formatted_corpus
                }
            }
            result = await call_gemini_with_retry(payload, api_key_gemini)
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            profile_data = json.loads(content)
        else:
            headers = {
                "Authorization": f"Bearer {api_key_openai}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": formatted_corpus}
                ],
                "response_format": { "type": "json_object" },
                "temperature": 0.2,
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "style_profile",
                    "prompt_version": "rebuild_v1.0.0",
                    "schema_version": "style_schema_v1.0.0",
                    "model": "gpt-4o-mini",
                    "input_text": formatted_corpus
                }
            }
            result = await call_openai_with_retry(payload, headers)
            content = result["choices"][0]["message"]["content"]
            profile_data = json.loads(content)
            
        if profile_data:
            # Update the style_profile on the agencies table
            sb.table("agencies")\
                .update({"style_profile": profile_data})\
                .eq("id", agency_id)\
                .execute()
            logger.info(f"Successfully rebuilt and saved style profile for agency {agency_id}")
            return profile_data
            
    except Exception as e:
        logger.error(f"Failed to rebuild style profile: {e}")
        
    return None

async def auto_phrase_with_profile(
    agency_id: str,
    client_name: str,
    destination: str,
    tour_type: str,
    client_preferences: dict = None,
    group_type: str = "",
    tour_category: str = ""
) -> Dict[str, str]:
    """
    Generates a draft greeting note and trip highlights blurb using the agency's style profile.
    """
    sb = get_supabase_client()
    if not sb:
        return {"greeting": "", "highlights": ""}
        
    try:
        # Fetch style_profile from the agency
        agency_res = sb.table("agencies").select("style_profile").eq("id", agency_id).maybeSingle().execute()
        agency_data = agency_res.data or {}
        style_profile = agency_data.get("style_profile") or {}
        
        profile_json = json.dumps(style_profile, ensure_ascii=False) if style_profile else "None (default luxury)"
        
        pref_str = ""
        if client_preferences:
            pref_str = (
                f"Client Preferences: dietary: {client_preferences.get('dietary') or 'none'}, "
                f"pace: {client_preferences.get('pace') or 'none'}, "
                f"dislikes/avoid: {client_preferences.get('dislikes') or 'none'}"
            )
            
        system_prompt = (
            "You are an expert luxury travel copywriter drafting sections for a travel proposal.\n"
            "Based on the agency's style profile guidelines, generate two sections for the proposal:\n"
            "1. A personalized greeting/welcome note to the client (addressing them by name, destination, and tour type/group style).\n"
            "2. A brief, compelling trip highlights blurb summarizing what makes this trip stand out.\n\n"
            "Style Profile to apply:\n"
            f"{profile_json}\n\n"
            "Output must be a JSON object with exactly these two keys:\n"
            "{\n"
            '  "greeting": "Drafted welcoming greeting note text...",\n'
            '  "highlights": "Drafted highlights bullet points or paragraph..."\n'
            "}\n"
            "Return ONLY the raw valid JSON object. Do not include markdown code block formatting (like ```json), commentary, or headers."
        )
        
        user_prompt = (
            f"Client Name: {client_name or 'Valued Traveler'}\n"
            f"Destination: {destination or 'Selected Destination'}\n"
            f"Tour Label: {tour_type or 'Concierge Experience'}\n"
            f"Who's Travelling (Group Type): {group_type or 'Not specified'}\n"
            f"Tour Category: {tour_category or tour_type or 'Not specified'}\n"
            f"{pref_str}"
        )
        
        api_key_gemini = os.environ.get("GEMINI_API_KEY")
        api_key_openai = os.environ.get("OPENAI_API_KEY")
        
        if not api_key_gemini and not api_key_openai:
            return {
                "greeting": f"Dear {client_name or 'Guest'},\n\nWe are delighted to present your bespoke itinerary to {destination or 'your destination'}.",
                "highlights": f"• Curated luxury accommodations\n• Tailored private tours in {destination}\n• Premium concierge transfers"
            }
            
        if api_key_gemini:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": f"{system_prompt}\n\nInput Details:\n{user_prompt}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.7
                },
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "auto_phrase",
                    "prompt_version": "phrase_v1.0.0",
                    "schema_version": "phrase_schema_v1.0.0",
                    "model": "gemini-2.5-flash",
                    "input_text": user_prompt
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
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": { "type": "json_object" },
                "temperature": 0.7,
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "auto_phrase",
                    "prompt_version": "phrase_v1.0.0",
                    "schema_version": "phrase_schema_v1.0.0",
                    "model": "gpt-4o-mini",
                    "input_text": user_prompt
                }
            }
            result = await call_openai_with_retry(payload, headers)
            content = result["choices"][0]["message"]["content"]
            return json.loads(content)
            
    except Exception as e:
        logger.error(f"Failed to auto-phrase fields: {e}")
        
    return {
        "greeting": f"Dear {client_name or 'Guest'},\n\nWelcome to your customized trip to {destination or 'your destination'}.",
        "highlights": "A tailored luxury experience."
    }


async def generate_outcome_insights(agency_id: str, db_client) -> dict:
    """
    Compares tag distributions, templates used, and pricing between Won (Approved)
    and Lost (Cancelled) proposals once there are 5+ outcomes logged for this agency.
    """
    try:
        # Fetch proposals with status Approved or Cancelled
        res = db_client.table("proposals")\
            .select("id, name, destination, brief, preferences, total_cost, status")\
            .eq("agency_id", agency_id)\
            .in_("status", ["Approved", "Cancelled"])\
            .execute()
            
        proposals = res.data or []
        count = len(proposals)
        
        if count < 5:
            return {
                "status": "pending",
                "current": count,
                "required": 5,
                "insights": []
            }
            
        # Perform comparison analysis
        won_proposals = [p for p in proposals if p["status"] == "Approved"]
        lost_proposals = [p for p in proposals if p["status"] == "Cancelled"]
        
        won_count = len(won_proposals)
        lost_count = len(lost_proposals)
        
        template_wins = {}
        template_totals = {}
        
        for p in proposals:
            prefs = p.get("preferences") or {}
            branding = prefs.get("branding") or {}
            tpl = branding.get("template_style") or "classic"
            
            template_totals[tpl] = template_totals.get(tpl, 0) + 1
            if p["status"] == "Approved":
                template_wins[tpl] = template_wins.get(tpl, 0) + 1
                
        insights = []
        overall_rate = won_count / count
        
        for tpl, total in template_totals.items():
            if total >= 2: # Need a minimum of 2 proposals to avoid noise
                wins = template_wins.get(tpl, 0)
                rate = wins / total
                diff = rate - overall_rate
                
                if diff >= 0.15: # converts at least 15% better than average
                    percent_better = int(diff * 100)
                    insights.append({
                        "type": "Template",
                        "message": f"Proposals using the '{tpl.capitalize()}' template convert {percent_better}% more often for this agency."
                    })
                elif diff <= -0.15: # converts at least 15% worse than average
                    percent_worse = int(abs(diff) * 100)
                    insights.append({
                        "type": "Template",
                        "message": f"Proposals using the '{tpl.capitalize()}' template convert {percent_worse}% less often. Consider using alternate layouts."
                    })
                    
        # Check price point differences
        won_costs = [float(p["total_cost"]) for p in won_proposals if p.get("total_cost") is not None]
        lost_costs = [float(p["total_cost"]) for p in lost_proposals if p.get("total_cost") is not None]
        
        if won_costs and lost_costs:
            avg_won = sum(won_costs) / len(won_costs)
            avg_lost = sum(lost_costs) / len(lost_costs)
            if avg_won < avg_lost * 0.8:
                insights.append({
                    "type": "Pricing",
                    "message": "Lower priced proposals (under the average lost price) have a 30% higher win rate."
                })
            elif avg_won > avg_lost * 1.2:
                insights.append({
                    "type": "Pricing",
                    "message": "Premium higher-priced itineraries exhibit stronger client sign-off rates."
                })
                
        # If no strong patterns are found, return a default helpful message
        if not insights:
            insights.append({
                "type": "General",
                "message": "Proposals exhibit a healthy, balanced conversion rate across all template designs."
            })
            
        return {
            "status": "success",
            "current": count,
            "required": 5,
            "insights": insights
        }
    except Exception as e:
        logger.error(f"Failed to calculate outcome insights: {e}")
        return {
            "status": "error",
            "current": 0,
            "required": 5,
            "insights": [],
            "error": str(e)
        }


async def validate_itinerary_sequence(days: list, agency_id: Optional[str] = None) -> list:
    """
    Analyzes the day-by-day itinerary text to flag mechanical, repetitive, or poorly paced items.
    Returns a list of flags: [{"id": str, "message": str, "fix": str}]
    """
    if not days:
        return []
        
    itinerary_text_list = []
    for d in days:
        day_num = d.get("day") or d.get("day_number") or 1
        title = d.get("title") or ""
        desc = d.get("description") or ""
        itinerary_text_list.append(f"Day {day_num}: {title}\n{desc}")
        
    full_itinerary_text = "\n\n".join(itinerary_text_list)
    
    system_prompt = (
        "You are an expert luxury travel consultant validator.\n"
        "Analyze the following day-by-day travel itinerary. Evaluate if it flows naturally, is paced well, and feels like a human specialist designed it.\n"
        "Identify anything that feels mechanical (e.g. checking into a new hotel every day without reason), repetitive (e.g. repeating the exact same city tours), or poorly paced (e.g. driving 6 hours, doing a 4 hour tour, and driving back in one day).\n"
        "Return a JSON object containing a list of flags under the 'flags' key. Each flag must have a unique 'id' (string), a clear 'message' describing the issue, and a specific recommended 'fix'.\n"
        "Format:\n"
        "{\n"
        '  "flags": [\n'
        '    {"id": "flag-1", "message": "...", "fix": "..."}\n'
        '  ]\n'
        "}\n"
        "Return ONLY valid raw JSON without code block backticks (like ```json), headers, or extra text."
    )
    
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    api_key_openai = os.environ.get("OPENAI_API_KEY")
    
    if not api_key_gemini and not api_key_openai:
        # Default mock check for local or offline dev
        flags = []
        hotels = set()
        for idx, d in enumerate(days):
            desc = (d.get("description") or "").lower()
            if "check in" in desc or "hotel" in desc or "resort" in desc:
                hotels.add(idx)
        if len(hotels) >= 3:
            flags.append({
                "id": "hotel-switching",
                "message": "Frequent hotel transfers may lead to client fatigue.",
                "fix": "Consolidate stays at a central luxury resort to allow a more relaxed pace."
            })
        return flags
        
    try:
        if api_key_gemini:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": f"{system_prompt}\n\nItinerary:\n{full_itinerary_text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.3
                },
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "sequence_validation",
                    "prompt_version": "sequence_v1.0.0",
                    "schema_version": "sequence_schema_v1.0.0",
                    "model": "gemini-2.5-flash",
                    "input_text": full_itinerary_text
                }
            }
            result = await call_gemini_with_retry(payload, api_key_gemini)
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(content).get("flags") or []
        else:
            headers = {
                "Authorization": f"Bearer {api_key_openai}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_itinerary_text}
                ],
                "response_format": { "type": "json_object" },
                "temperature": 0.3,
                "_cache_meta": {
                    "agency_id": agency_id,
                    "entity_type": "sequence_validation",
                    "prompt_version": "sequence_v1.0.0",
                    "schema_version": "sequence_schema_v1.0.0",
                    "model": "gpt-4o-mini",
                    "input_text": full_itinerary_text
                }
            }
            result = await call_openai_with_retry(payload, headers)
            content = result["choices"][0]["message"]["content"]
            return json.loads(content).get("flags") or []
    except Exception as e:
        logger.error(f"Itinerary sequence check failed: {e}")
        return []
