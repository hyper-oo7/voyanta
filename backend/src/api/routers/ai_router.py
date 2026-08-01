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



@router.post("/assemble-1shot")
async def assemble_1shot_route(
    input: Assemble1ShotInput,
    user: Any = Depends(verify_token_optional)
):
    """
    1-Shot Automated Assembly Endpoint.
    Assembles a complete, costed, and branded proposal in under 1.5 seconds.
    Leverages zero-cost in-memory Day Module caching.
    """
    try:
        from src.models.day_module_schema import MarginConfig
        from src.services.assembly_engine import assemble_1shot_proposal

        agency_id = "global"
        if isinstance(user, dict):
            agency_id = (
                (user.get("user_metadata") or {}).get("agency_id")
                or (user.get("app_metadata") or {}).get("agency_id")
                or user.get("agency_id")
                or "global"
            )

        margin_cfg = MarginConfig(
            margin_type="percentage" if input.margin_type.lower() == "percentage" else "flat",
            margin_value=float(input.margin_value),
            tax_rate_percent=float(input.tax_rate_percent),
            discount_amount=float(input.discount_amount),
            visibility_mode="TOTAL_ONLY" if input.visibility_mode.upper() == "TOTAL_ONLY" else "ITEMIZED"
        )

        # If prompt is provided, extract destination and duration via regex/light parsing
        dest = input.destination
        dur = input.duration_days
        pref = input.preferences_text

        if input.prompt:
            import re
            p_text = input.prompt.strip()
            # Extract duration e.g. '4 day' or '5 days'
            dur_match = re.search(r"(\d+)\s*day", p_text, re.IGNORECASE)
            if dur_match:
                dur = int(dur_match.group(1))

            # Extract destination
            if not dest:
                for kw in ["Manali", "Shillong", "Leh", "Kerala", "Rajasthan", "Goa", "Kashmir", "Rishikesh", "Jaipur", "Udaipur"]:
                    if kw.lower() in p_text.lower():
                        dest = kw
                        break
            if not dest:
                dest = "Himachal"

            pref = f"{pref} {p_text}".strip()

        if not dest:
            dest = "Himachal"

        proposal = assemble_1shot_proposal(
            destination=dest,
            duration_days=dur,
            client_name=input.client_name,
            group_type=input.group_type,
            pace=input.pace,
            budget_per_head=input.budget_per_head,
            num_travelers=input.num_travelers,
            preferences_text=pref,
            margin_config=margin_cfg,
            agency_id=agency_id
        )

        return {"status": "success", "proposal": proposal.model_dump(by_alias=True)}

    except Exception as e:
        logger.exception("[1-Shot Assembly] Generation failed")
        raise HTTPException(status_code=500, detail=str(e))



