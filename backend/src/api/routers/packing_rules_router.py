import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from src.core.security import verify_token, get_request_token
from src.services.supabase_client import get_user_supabase_client


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/packing-rules", tags=["Agency Packing Memory"])

class PackingRuleUpsertRequest(BaseModel):
    destination_keyword: str
    section_type: str = "what_to_pack"
    section_title: str = "What to Pack"
    content: str

# In-memory local fallback store for demo/unauthenticated mode or sqlite fallback
_LOCAL_AGENCY_MEMORY: Dict[str, Dict[str, Any]] = {}

@router.get("/match")
async def match_agency_packing_rules(
    destination: str = Query("", description="Primary destination e.g. Kashmir"),
    sub_destinations: str = Query("", description="Comma-separated sub-destinations e.g. Srinagar,Gulmarg"),
    user: Any = Depends(verify_token),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Returns agency-exclusive packing rules and extra sections matching either
    the primary destination or any sub-destination.
    100% agency-isolated via agency_id.
    """
    agency_id = None
    if isinstance(user, dict):
        agency_id = (user.get("user_metadata") or {}).get("agency_id") or (user.get("app_metadata") or {}).get("agency_id") or user.get("agency_id")

    if not agency_id:
        # Check local demo store
        dest_key = destination.lower().strip()
        matched = []
        for k, v in _LOCAL_AGENCY_MEMORY.items():
            if dest_key and dest_key in k:
                matched.append(v)
            elif any(sub.strip().lower() in k for sub in sub_destinations.split(",") if sub.strip()):
                matched.append(v)
        return {"status": "success", "rules": matched}

    try:
        sb = get_user_supabase_client(token)
        if not sb:
            return {"status": "success", "rules": []}

        # Query rules for this agency
        res = sb.table("agency_packing_rules").select("*").eq("agency_id", agency_id).execute()
        all_rules = res.data or []

        matched_rules = []
        dest_lower = destination.lower().strip()
        sub_list = [s.strip().lower() for s in sub_destinations.split(",") if s.strip()]

        for rule in all_rules:
            kw = (rule.get("destination_keyword") or "").lower()
            if not kw:
                continue
            if (dest_lower and kw in dest_lower) or any(kw in sub for sub in sub_list) or (dest_lower and dest_lower in kw):
                matched_rules.append(rule)

        return {"status": "success", "rules": matched_rules}
    except Exception as e:
        logger.error(f"[PackingRules] Failed to query DB: {e}")
        return {"status": "success", "rules": []}

@router.post("/upsert")
async def upsert_agency_packing_rule(
    payload: PackingRuleUpsertRequest,
    user: Any = Depends(verify_token),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Saves or updates an agency-exclusive packing rule or extra section.
    """
    agency_id = None
    if isinstance(user, dict):
        agency_id = (user.get("user_metadata") or {}).get("agency_id") or (user.get("app_metadata") or {}).get("agency_id") or user.get("agency_id")

    kw = payload.destination_keyword.lower().strip()
    if not agency_id:
        _LOCAL_AGENCY_MEMORY[f"demo_{kw}_{payload.section_type}"] = {
            "destination_keyword": kw,
            "section_type": payload.section_type,
            "section_title": payload.section_title,
            "content": payload.content
        }
        return {"status": "success", "message": "Saved to local demo store"}

    try:
        sb = get_user_supabase_client(token)
        if sb:
            data = {
                "agency_id": agency_id,
                "destination_keyword": kw,
                "section_type": payload.section_type,
                "section_title": payload.section_title,
                "content": payload.content
            }
            sb.table("agency_packing_rules").upsert(data, on_conflict="agency_id,destination_keyword,section_type").execute()
            return {"status": "success", "message": "Saved to agency_packing_rules DB"}
    except Exception as e:
        logger.error(f"[PackingRules] Failed to upsert DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))
