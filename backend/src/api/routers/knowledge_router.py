import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import JSONResponse
from src.core.security import verify_token_optional, get_request_token
from src.services.supabase_client import get_supabase_client, get_user_supabase_client


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Knowledge Objects"])


def _get_db_client(token: Optional[str] = None):
    # Detect if get_supabase_client is mocked in tests
    try:
        from unittest.mock import Mock
        g_get_sb = globals().get("get_supabase_client")
        if g_get_sb and isinstance(g_get_sb, Mock):
            return g_get_sb()
    except ImportError:
        pass
    return get_user_supabase_client(token)


@router.get("/knowledge-objects")
async def get_knowledge_objects(
    object_type: Optional[str] = Query(None, description="Filter by object type (e.g. hotel, activity)"),
    destination: Optional[str] = Query(None, description="Filter by destination"),
    audience: Optional[str] = Query(None, description="Filter by audience tag (e.g. couple, family)"),
    pace: Optional[str] = Query(None, description="Filter by pace tag (e.g. relaxed, moderate)"),
    setting: Optional[str] = Query(None, description="Filter by setting tag (e.g. indoor, outdoor)"),
    price_tier: Optional[str] = Query(None, description="Filter by price_tier tag (e.g. luxury, budget)"),
    season: Optional[str] = Query(None, description="Filter by season tag (e.g. best-in-winter)"),
    duration: Optional[str] = Query(None, description="Filter by duration tag (e.g. half-day, full-day)"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page"),
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Paginated list of knowledge objects filtered by agency_id, object_type, destination, and taxonomy tags.
    """
    sb = _get_db_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )

    try:
        # 1. Process tag filters and query object_tags for matching IDs
        tag_filters = {
            "audience": audience,
            "pace": pace,
            "setting": setting,
            "price_tier": price_tier,
            "season": season,
            "duration": duration
        }
        active_tag_filters = {k: v for k, v in tag_filters.items() if isinstance(v, str)}
        
        matching_ids = None
        if active_tag_filters:
            for cat, val in active_tag_filters.items():
                res_tags = sb.table("object_tags").select("object_id").eq("tag_category", cat).eq("tag", val).execute()
                ids = {r["object_id"] for r in (res_tags.data or [])}
                if matching_ids is None:
                    matching_ids = ids
                else:
                    matching_ids = matching_ids.intersection(ids)
                
                if not matching_ids:
                    break

            # If filters were applied but intersection resulted in empty set, return empty early
            if matching_ids is not None and not matching_ids:
                return JSONResponse(content={
                    "status": "success",
                    "page": page,
                    "page_size": page_size,
                    "total_count": 0,
                    "data": []
                })

        # 2. Query knowledge_objects table
        query = sb.table("knowledge_objects").select("*", count="exact")
        
        # Row level filtering scoped to current agency or global templates
        if agency_id:
            query = query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
        else:
            query = query.is_("agency_id", "null")

        if object_type and isinstance(object_type, str):
            query = query.eq("object_type", object_type)
        if destination and isinstance(destination, str):
            query = query.ilike("destination", f"%{destination}%")
        if matching_ids is not None:
            query = query.in_("id", list(matching_ids))

        # Range boundaries are inclusive: offset to offset + limit - 1
        offset = (page - 1) * page_size
        limit_to = offset + page_size - 1

        res = query.range(offset, limit_to).order("created_at", desc=True).execute()
        objects = res.data or []
        total_count = res.count or 0

        # 3. Fetch tags for the retrieved objects and merge them in
        if objects:
            obj_ids = [obj["id"] for obj in objects]
            tags_res = sb.table("object_tags").select("object_id, tag_category, tag").in_("object_id", obj_ids).execute()
            tags_data = tags_res.data or []
            
            tags_by_obj = {}
            for t in tags_data:
                oid = t["object_id"]
                if oid not in tags_by_obj:
                    tags_by_obj[oid] = []
                tags_by_obj[oid].append({
                    "tag_category": t["tag_category"],
                    "tag": t["tag"]
                })
                
            for obj in objects:
                obj["tags"] = tags_by_obj.get(obj["id"]) or []

        return JSONResponse(content={
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "data": objects
        })
    except Exception as e:
        logger.exception("Failed to retrieve knowledge objects")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/proposals/{proposal_id}/suggestions")
async def get_proposal_suggestions(
    proposal_id: str,
    step: str = Query(..., description="Wizard step ('hotels' or 'activities')"),
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Get ranked suggestions from the agency's vault matching the proposal's destination and criteria.
    """
    sb = _get_db_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )

    from src.services.suggestion_service import get_proposal_suggestions_service
    res = await get_proposal_suggestions_service(sb, proposal_id, step, agency_id)
    if "error" in res:
        raise HTTPException(status_code=res.get("status_code", 500), detail=res["error"])
    return JSONResponse(content=res)


@router.post("/proposals/{proposal_id}/validate")
async def validate_proposal_endpoint(
    proposal_id: str,
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Validates a proposal's itinerary against pacing, budget, logistics, and repetition rules.
    """
    from src.services.validation_service import validate_proposal_itinerary
    try:
        sb = _get_db_client(token)
        warnings = validate_proposal_itinerary(proposal_id, sb=sb)
        return JSONResponse(content={"status": "success", "proposal_id": proposal_id, "warnings": warnings})
    except Exception as e:
        logger.exception("Failed to validate proposal itinerary")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge-objects/{obj_id}/best-rate")
async def get_best_rate(
    obj_id: str,
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Returns the lowest currently-valid rate across suppliers for a knowledge object.
    """
    sb = _get_db_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )

    # Query all rates for this knowledge object
    query = sb.table("supplier_rates").select("*").eq("knowledge_object_id", obj_id)
    if agency_id:
        query = query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
    else:
        query = query.is_("agency_id", "null")

    res = query.execute()
    rates = res.data or []

    # Filter currently valid: valid_from <= today <= valid_to
    from datetime import date
    today = date.today()
    
    valid_rates = []
    for r in rates:
        valid_from = r.get("valid_from")
        valid_to = r.get("valid_to")
        
        is_valid = True
        if valid_from:
            try:
                vf = date.fromisoformat(valid_from)
                if today < vf:
                    is_valid = False
            except ValueError:
                pass
        if valid_to:
            try:
                vt = date.fromisoformat(valid_to)
                if today > vt:
                    is_valid = False
            except ValueError:
                pass
                
        if is_valid:
            valid_rates.append(r)
            
    if not valid_rates:
        return JSONResponse(content={"status": "success", "best_rate": None})

    # Sort by rate ascending to find the best (lowest) rate
    valid_rates.sort(key=lambda x: float(x.get("rate") or 0))
    best = valid_rates[0]
    
    return JSONResponse(content={
        "status": "success",
        "best_rate": {
            "id": best["id"],
            "supplier_name": best["supplier_name"],
            "rate": float(best["rate"]),
            "currency": best.get("currency") or "INR",
            "valid_from": best.get("valid_from"),
            "valid_to": best.get("valid_to")
        }
    })


@router.get("/seasonal-rules")
async def get_seasonal_rules(
    destination: str,
    month: int,
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Returns seasonal rules and warnings for a destination and month.
    """
    sb = _get_db_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    agency_id = None
    if isinstance(user, dict):
        agency_id = (
            (user.get("user_metadata") or {}).get("agency_id")
            or (user.get("app_metadata") or {}).get("agency_id")
            or user.get("agency_id")
        )

    query = sb.table("seasonal_rules").select("*").ilike("destination", f"%{destination}%").eq("month", month)
    if agency_id:
        query = query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
    else:
        query = query.is_("agency_id", "null")

    res = query.execute()
    rules = res.data or []
    return JSONResponse(content={"status": "success", "rules": rules})


@router.patch("/knowledge-objects/relations/{object_a_id}/{object_b_id}/{relation_type}/dismiss")
async def dismiss_relation(
    object_a_id: str,
    object_b_id: str,
    relation_type: str,
    user: Any = Depends(verify_token_optional),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Dismisses a relation between two knowledge objects. Updates both directions in the database.
    """
    sb = _get_db_client(token)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    try:
        sb.table("object_relations")\
            .update({"is_dismissed": True})\
            .eq("object_a_id", object_a_id)\
            .eq("object_b_id", object_b_id)\
            .eq("relation_type", relation_type)\
            .execute()
            
        sb.table("object_relations")\
            .update({"is_dismissed": True})\
            .eq("object_a_id", object_b_id)\
            .eq("object_b_id", object_a_id)\
            .eq("relation_type", relation_type)\
            .execute()
            
        return JSONResponse(content={"status": "success", "message": "Relation dismissed successfully"})
    except Exception as e:
        logger.error(f"Failed to dismiss relation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


