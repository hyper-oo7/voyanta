from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional
from pydantic import BaseModel
import logging

from src.models.api_models import ParseItineraryInput
from src.core.security import verify_token, verify_token_optional, get_request_token
from src.services.supabase_client import get_user_supabase_client

from src.services.ai_service import extract_itinerary, translate_proposal_content, generate_luxury_title, enhance_luxury_text

logger = logging.getLogger(__name__)
router = APIRouter()

class TranslateProposalInput(BaseModel):
    proposal: Dict[str, Any]
    target_lang: str
    glossary: Dict[str, str] = {}

class GenerateTitleInput(BaseModel):
    destination: str = ""
    tour_type: str = ""
    duration: int = 7
    group_type: str = ""
    tour_category: str = ""

class EnhanceTextInput(BaseModel):
    text: str
    mode: str = "grammar"
    destination: str = ""
    length: Optional[str] = None
    format: Optional[str] = None
    tier: Optional[str] = None

@router.post("/parse-itinerary")
async def parse_itinerary(input: ParseItineraryInput, user: Any = Depends(verify_token_optional)):
    try:
        return await extract_itinerary(input.text)
    except Exception as e:
        logger.exception("AI itinerary parsing failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/translate-proposal")
async def translate_proposal(input: TranslateProposalInput, user: Any = Depends(verify_token_optional)):
    try:
        translated = await translate_proposal_content(input.proposal, input.target_lang, input.glossary)
        return {"success": True, "translated_proposal": translated}
    except Exception as e:
        logger.exception("AI proposal translation failed")
        return {"success": False, "translated_proposal": input.proposal, "error": str(e)}

@router.post("/generate-title")
async def generate_title(input: GenerateTitleInput, user: Any = Depends(verify_token_optional)):
    try:
        title = await generate_luxury_title(
            input.destination, 
            input.tour_type, 
            input.duration,
            group_type=input.group_type,
            tour_category=input.tour_category
        )
        return {"success": True, "title": title}
    except Exception as e:
        logger.exception("AI generate-title failed")
        return {"success": False, "title": f"{input.destination or 'Luxury'} Collection: A Curated {input.duration}-Day {input.tour_type or 'Journey'}", "error": str(e)}

@router.post("/enhance-text")
async def enhance_text(input: EnhanceTextInput, user: Any = Depends(verify_token_optional)):
    try:
        model = "gemini"
        prompt_version = "v1.1.0"
        schema_version = "v1.1.0"
        
        normalized_input = f"mode:{input.mode}|dest:{input.destination}|len:{input.length or 'default'}|fmt:{input.format or 'default'}|tier:{input.tier or 'default'}|text:{input.text}"

        from src.services.ai_cache_service import get_cached_extraction, save_cached_extraction
        
        # Check cache (globally, agency_id = None)
        cached = await get_cached_extraction(
            agency_id=None,
            model=model,
            prompt_version=prompt_version,
            schema_version=schema_version,
            normalized_input=normalized_input
        )
        if cached and isinstance(cached, dict) and "enhanced_text" in cached:
            logger.info("[AICache] Global Cache HIT for enhance-text")
            return {"success": True, "enhanced_text": cached["enhanced_text"], "cached": True}

        # If cache miss, generate via Gemini
        enhanced = await enhance_luxury_text(input.text, input.mode, input.destination, input.length, input.format, input.tier)
        
        # Save to global cache
        await save_cached_extraction(
            agency_id=None,
            entity_type="sensory_expansion",
            entity_id=None,
            model=model,
            prompt_version=prompt_version,
            schema_version=schema_version,
            normalized_input=normalized_input,
            output_json={"enhanced_text": enhanced}
        )
        
        return {"success": True, "enhanced_text": enhanced, "cached": False}
    except Exception as e:
        logger.exception("AI enhance-text failed")
        return {"success": False, "enhanced_text": input.text, "error": str(e)}


class AutoPhraseInput(BaseModel):
    client_name: str = ""
    destination: str = ""
    tour_type: str = ""
    group_type: str = ""
    tour_category: str = ""
    client_preferences: Dict[str, Any] = {}
    num_adults: int = 2
    num_children: int = 0


@router.post("/agencies/style-profile/rebuild")
async def rebuild_agency_style_profile(
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Triggers summarizing finalized proposals and PDFs to build the agency style profile.
    """
    sb = get_user_supabase_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )
        
    if not agency_id:
        try:
            res = sb.table("agencies").select("id").limit(1).execute()
            if res.data:
                agency_id = res.data[0]["id"]
        except Exception:
            pass
            
    if not agency_id:
        agency_id = "voyanta_demo_agency"
        
    from src.services.proposal_style_service import rebuild_style_profile
    profile = await rebuild_style_profile(agency_id)
    if profile is None:
        raise HTTPException(status_code=500, detail="Failed to generate style profile")
        
    return {"status": "success", "style_profile": profile}


@router.post("/proposals/auto-phrase")
async def auto_phrase_proposal(
    input: AutoPhraseInput,
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Auto-phrases customized greeting and highlights text using the agency's style profile.
    """
    sb = get_user_supabase_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )
        
    if not agency_id:
        try:
            res = sb.table("agencies").select("id").limit(1).execute()
            if res.data:
                agency_id = res.data[0]["id"]
        except Exception:
            pass
            
    if not agency_id:
        agency_id = "voyanta_demo_agency"
        
    from src.services.proposal_style_service import auto_phrase_with_profile
    draft = await auto_phrase_with_profile(
        agency_id=agency_id,
        client_name=input.client_name,
        destination=input.destination,
        tour_type=input.tour_type,
        client_preferences=input.client_preferences,
        group_type=input.group_type,
        tour_category=input.tour_category,
        num_adults=input.num_adults,
        num_children=input.num_children
    )
    return {"status": "success", "draft": draft}


@router.get("/agencies/outcome-insights")
async def get_outcome_insights(
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Returns dynamically computed style and template outcome insights for the agency.
    """
    sb = get_user_supabase_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )
        
    if not agency_id:
        try:
            res = sb.table("agencies").select("id").limit(1).execute()
            if res.data:
                agency_id = res.data[0]["id"]
        except Exception:
            pass
            
    if not agency_id:
        agency_id = "voyanta_demo_agency"
        
    from src.services.proposal_style_service import generate_outcome_insights
    return await generate_outcome_insights(agency_id, sb)


class ValidateSequenceInput(BaseModel):
    days: list = []

class InvalidateCacheInput(BaseModel):
    cache_key: str

@router.post("/proposals/validate-sequence")
async def validate_sequence(input: ValidateSequenceInput, user: Any = Depends(verify_token_optional)):
    """
    Validates formatting, pacing, flow and repetition of proposal itinerary days.
    """
    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )
        
    from src.services.proposal_style_service import validate_itinerary_sequence
    flags = await validate_itinerary_sequence(input.days, agency_id=agency_id)
    return {"status": "success", "flags": flags}

@router.get("/ai/cache/stats")
async def get_cache_statistics(user: Any = Depends(verify_token_optional)):
    """
    Returns AI extraction caching performance and savings metrics.
    """
    from src.services.ai_cache_service import get_cache_stats
    stats = await get_cache_stats()
    return {"status": "success", "stats": stats}

@router.post("/ai/cache/invalidate")
async def invalidate_cache_key(input: InvalidateCacheInput, user: Any = Depends(verify_token_optional)):
    """
    Manually invalidates a specific cache entry.
    """
    from src.services.ai_cache_service import invalidate_cache
    success = await invalidate_cache(input.cache_key)
    return {"status": "success", "invalidated": success}

@router.get("/ai/health")
async def ai_health_check():
    """
    Single authoritative health check endpoint for verifying AI providers & LLM cascading.
    Verifies active models: gemini-2.5-flash and gpt-4o-mini.
    """
    import os
    import time
    from fastapi.responses import JSONResponse
    from src.services.ai_client import call_llm, GEMINI_MODEL, OPENAI_MODEL

    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    res = {
        "status": "unhealthy",
        "active_models": {
            "gemini": GEMINI_MODEL,
            "openai": OPENAI_MODEL
        },
        "providers": {
            "gemini": {"configured": bool(gemini_key), "status": "untested"},
            "openai": {"configured": bool(openai_key), "status": "untested"}
        }
    }

    if not gemini_key and not openai_key:
        res["message"] = "Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured in environment."
        return JSONResponse(status_code=503, content=res)

    # Test active provider
    start_time = time.time()
    try:
        ping_res = await call_llm(
            prompt="Respond with exact word 'OK'",
            system_prompt="You are a healthcheck bot.",
            temperature=0.0
        )
        latency = round((time.time() - start_time) * 1000, 2)
        res["status"] = "healthy"
        res["active_provider_ping"] = {"status": "ok", "latency_ms": latency, "response": ping_res[:50].strip()}
        if gemini_key:
            res["providers"]["gemini"]["status"] = "ok"
        elif openai_key:
            res["providers"]["openai"]["status"] = "ok"
    except Exception as e:
        logger.error(f"[AI Health] Healthcheck ping failed: {e}")
        res["status"] = "degraded"
        res["active_provider_ping"] = {"status": "error", "error": str(e)}

    return res


class Assemble1ShotInput(BaseModel):
    destination: Optional[str] = None
    prompt: Optional[str] = None
    duration_days: int = 3
    days_per_destination: Optional[Dict[str, int]] = None
    client_name: str = "Valued Traveler"
    contact_info: Optional[str] = None
    group_type: str = "friends"
    pace: str = "medium"
    budget_per_head: float = 25000.0
    budget_band: str = "mid"  # low, mid, high
    num_travelers: int = 2
    num_adults: int = 2
    num_children: int = 0
    theme_tags: Optional[list] = None  # family, honeymoon, adventure, budget, luxury
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_city: Optional[str] = None  # arrival point for transfer logic
    end_city: Optional[str] = None
    preferences_text: str = ""
    margin_type: str = "percentage"
    margin_value: float = 15.0
    tax_rate_percent: float = 5.0
    discount_amount: float = 0.0
    visibility_mode: str = "ITEMIZED"
    rag_context: Optional[Dict[str, Any]] = None
    vault_matches: Optional[Dict[str, Any]] = None



from src.models.assembly_schemas import AssembleRequest, AssembleResponse, CostingPrefs, RAGContext, VaultMatches

@router.post("/assemble-1shot", response_model=AssembleResponse)
async def assemble_1shot_route(
    req: AssembleRequest,
    user: Any = Depends(verify_token_optional)
):
    """
    Agentic 1-Shot Assembly Endpoint.
    Accepts client brief + RAG context + vault matches.
    Returns a fully costed proposal with real resource IDs.
    """
    try:
        from src.services.agentic_assembly_service import assemble_itinerary
        proposal = await assemble_itinerary(req)
        return AssembleResponse(status="success", proposal=proposal)
    except ValueError as e:
        logger.warning(f"[1-Shot Agentic] Validation/Inventory warning: {e}")
        # Try deterministic engine as fallback
        try:
            from src.services.assembly_engine import assemble_1shot_proposal
            from src.models.day_module_schema import MarginConfig
            margin_cfg = MarginConfig(
                margin_type=req.costing_prefs.margin_type,
                margin_value=req.costing_prefs.margin_value,
                tax_rate_percent=req.costing_prefs.tax,
                discount_amount=req.costing_prefs.discount,
                visibility_mode=req.costing_prefs.visibility_mode
            )
            fallback_prop = assemble_1shot_proposal(
                destination=req.destination,
                duration_days=req.duration_days,
                client_name=req.client_name,
                num_travelers=req.num_travelers,
                budget_per_head=req.budget_per_head or 25000.0,
                pace=req.pace or "medium",
                margin_config=margin_cfg
            )
            return AssembleResponse(status="success", proposal=fallback_prop.dict(), used_fallback=True)
        except Exception as fb_err:
            return AssembleResponse(
                status="insufficient_inventory",
                detail=str(e),
                used_fallback=True
            )
    except Exception as e:
        logger.exception("Agentic Assembly engine error")
        raise HTTPException(status_code=500, detail=f"Assembly engine error: {str(e)}")

    except Exception as e:
        logger.exception("[1-Shot Assembly] Generation failed")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateDayModuleInput(BaseModel):
    sub_destination: str
    agency_id: Optional[str] = "global"

@router.post("/generate-day-module")
async def generate_day_module(
    input: GenerateDayModuleInput,
    user: Any = Depends(verify_token_optional)
):
    """
    Generate a dynamic ProposalDay block using RAG data for a specific sub-destination.
    """
    agency_id = "global"
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
            or "global"
        )
    
    # Run RAG query for this specific sub-destination
    from src.services.rag_engine import rag_engine
    rag_result = rag_engine.run_rag(
        agency_id=agency_id,
        destination=input.sub_destination,
        duration_days=1,
        travelers=2,
        travel_style="standard",
    )
    
    prompt = f"""
    Based on the following retrieved knowledge from our past proposals/PDFs, generate a single Day itinerary block for the sub-destination: {input.sub_destination}.
    Do NOT invent attractions or hotels that are not present in the context. If the context is empty, provide a generic but realistic day for {input.sub_destination}.
    
    CONTEXT:
    {rag_result['context']}
    
    Respond strictly in JSON format matching this schema:
    {{
        "title": "Day X: Title here",
        "description": "Narrative description of the day",
        "sub_destination": "{input.sub_destination}",
        "activities": [
            {{"name": "Activity Name", "timing": "10:00 AM"}}
        ],
        "hotels": [
            {{"name": "Hotel Name", "category": "4 Star", "meal_plan": "MAP"}}
        ]
    }}
    """
    
    from src.services.ai_client import call_llm
    try:
        raw_text = await call_llm(
            prompt=prompt,
            system_prompt="You are an expert Voyanta travel curator. Always return valid JSON only.",
            temperature=0.5
        )
        
        import json
        clean_json = raw_text.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:-3].strip()
        elif clean_json.startswith("```"):
            clean_json = clean_json[3:-3].strip()
            
        day_module = json.loads(clean_json)
        return {"status": "success", "day_module": day_module}
    except Exception as e:
        logger.error(f"[AI GenerateDay] Failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate day module")

class RefineItineraryInput(BaseModel):
    proposal: Dict[str, Any]
    user_prompt: str

@router.post("/refine-itinerary")
async def refine_itinerary(
    input: RefineItineraryInput,
    user: Any = Depends(verify_token_optional)
):
    """
    Phase 5A: AI Proposal Chat
    Modifies an existing proposal based on a natural language user prompt.
    Allowed to restructure days completely.
    """
    from src.services.ai_client import call_llm
    import json
    
    prompt = f"""
    You are an expert luxury travel curator for Voyanta. 
    You are given a JSON representing a travel proposal, and a user request to modify it.
    The user request is: "{input.user_prompt}"
    
    CRITICAL INSTRUCTIONS:
    1. NEVER change the destination from '{input.proposal.get("destination", "the original destination")}' unless explicitly requested.
    2. If the current days list is empty and the user asks to add an activity, create a new day block for '{input.proposal.get("destination", "the original destination")}' and add the activity there. DO NOT hallucinate a trip to Manali.
    3. You are ALLOWED to completely restructure the days (e.g. changing duration) or swap hotels/activities to fulfill the user's request, but maintain the core destination context.
    
    Here is the current proposal JSON:
    {json.dumps(input.proposal, indent=2)}
    
    Respond STRICTLY with the modified JSON matching the same schema structure.
    Do NOT include markdown backticks like ```json in your response, just the raw JSON object.
    Ensure prices and totals are updated reasonably if days or hotels are changed.
    """
    
    try:
        raw_text = await call_llm(
            prompt=prompt,
            system_prompt="You are an expert Voyanta travel curator. Always return valid JSON only.",
            temperature=0.7
        )
        
        try:
            modified_proposal = json.loads(raw_text.strip())
        except Exception:
            import re
            json_match = re.search(r'\{[\s\S]+\}', raw_text)
            if json_match:
                modified_proposal = json.loads(json_match.group())
            else:
                raise ValueError("No JSON object could be extracted from LLM response.")
        return {"status": "success", "modified_proposal": modified_proposal}
    except Exception as e:
        logger.error(f"[AI RefineItinerary] Failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to refine itinerary")
