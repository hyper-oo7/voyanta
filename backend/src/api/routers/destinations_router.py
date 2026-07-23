"""
destinations_router.py
======================
FastAPI router for the India Destination Knowledge Base, sub-destinations, categorized activities,
global stock image auto-association, and CSV/JSON dynamic data-driven import.
"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from pydantic import BaseModel

from src.core.security import verify_token_optional, get_request_token
from src.services.supabase_client import get_supabase_client, get_user_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/destinations", tags=["India Destination Knowledge Base"])

class SubDestImagePayload(BaseModel):
    image_url: str
    image_source: Optional[str] = "stock" # 'stock' required for global persistence

class ActivityImagePayload(BaseModel):
    image_url: str
    image_source: Optional[str] = "stock"

class ImportDestinationItem(BaseModel):
    destination: str
    state_or_ut: Optional[str] = "India"
    region: Optional[str] = "India"
    sub_destination: str
    sub_dest_type: Optional[str] = "town"
    activity_name: str
    category: Optional[str] = "Sightseeing"
    duration_hours: Optional[float] = 2.0
    ideal_time_of_day: Optional[str] = "Morning"
    description: Optional[str] = ""
    image_url: Optional[str] = None

@router.get("/autocomplete")
async def autocomplete_destinations(
    q: str = Query("", description="Query string e.g. Meghalaya or Shillong"),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Returns matching destinations and their full list of sub-destinations.
    Selecting Meghalaya instantly returns Shillong, Cherrapunji, Dawki, Mawlynnong, etc.
    """
    sb = get_supabase_client()
    if not sb:
        return {"destinations": [], "sub_destinations": []}

    query_str = q.strip()
    if not query_str:
        # Return popular destinations as fallback
        dest_res = sb.table("destinations").select("*").limit(20).execute()
        return {"destinations": dest_res.data or [], "sub_destinations": []}

    # 1. Search destinations table
    dest_res = sb.table("destinations").select("*").ilike("name", f"%{query_str}%").execute()
    destinations = dest_res.data or []

    dest_ids = [d["id"] for d in destinations]
    sub_destinations = []

    # 2. Fetch sub-destinations for matched destinations
    if dest_ids:
        sub_res = sb.table("sub_destinations").select("*").in_("destination_id", dest_ids).execute()
        sub_destinations = sub_res.data or []

    # 3. Also search sub_destinations directly by name if query didn't match a destination
    if not destinations:
        sub_search = sb.table("sub_destinations").select("*, destinations(name, state_or_ut)").ilike("name", f"%{query_str}%").limit(30).execute()
        sub_destinations = sub_search.data or []

    return {
        "query": query_str,
        "destinations": destinations,
        "sub_destinations": sub_destinations
    }

@router.get("/sub-destinations")
async def get_sub_destinations(
    destination_name: Optional[str] = Query(None),
    destination_id: Optional[str] = Query(None),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Fetches sub-destinations for a given destination name or ID.
    """
    sb = get_supabase_client()
    if not sb:
        return {"sub_destinations": []}

    target_dest_id = destination_id
    if not target_dest_id and destination_name:
        d_res = sb.table("destinations").select("id").ilike("name", destination_name.strip()).maybe_single().execute()
        if d_res and d_res.data:
            target_dest_id = d_res.data["id"]

    if not target_dest_id:
        # Try ilike search on sub_destinations directly
        if destination_name:
            sub_res = sb.table("sub_destinations").select("*").ilike("name", f"%{destination_name}%").execute()
            return {"sub_destinations": sub_res.data or []}
        return {"sub_destinations": []}

    sub_res = sb.table("sub_destinations").select("*").eq("destination_id", target_dest_id).execute()
    return {"sub_destinations": sub_res.data or []}

@router.get("/activities")
async def get_destination_activities(
    sub_destinations: Optional[str] = Query(None, description="Comma-separated sub-destination names or IDs e.g. Shillong,Cherrapunji,Dawki"),
    destination_name: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    token: Optional[str] = Depends(get_request_token)
):
    """
    Fetches activities filtered by selected sub-destinations, category, and travel month.
    """
    sb = get_supabase_client()
    if not sb:
        return {"activities": []}

    sub_names_or_ids = [s.strip() for s in sub_destinations.split(",")] if sub_destinations else []
    
    # Resolve sub_destination IDs
    sub_ids = []
    if sub_names_or_ids:
        # Check if they are UUIDs or names
        names = [s for s in sub_names_or_ids if len(s) != 36]
        uuids = [s for s in sub_names_or_ids if len(s) == 36]
        sub_ids.extend(uuids)

        if names:
            sub_query = sb.table("sub_destinations").select("id").in_("name", names).execute()
            sub_ids.extend([row["id"] for row in (sub_query.data or [])])

    if not sub_ids and destination_name:
        # Fallback to fetching all sub-destinations under destination_name
        d_res = sb.table("destinations").select("id").ilike("name", destination_name.strip()).maybe_single().execute()
        if d_res and d_res.data:
            sub_q = sb.table("sub_destinations").select("id").eq("destination_id", d_res.data["id"]).execute()
            sub_ids = [row["id"] for row in (sub_q.data or [])]

    if not sub_ids:
        # Query general destination_activities
        q = sb.table("destination_activities").select("*, sub_destinations(name, type)").limit(50)
        if category:
            q = q.eq("category", category)
        res = q.execute()
        return {"activities": res.data or []}

    query = sb.table("destination_activities").select("*, sub_destinations(name, type)").in_("sub_destination_id", sub_ids)
    if category:
        query = query.eq("category", category)

    res = query.execute()
    activities = res.data or []

    # Optional month filter
    if month and isinstance(month, int) and 1 <= month <= 12:
        activities = [a for a in activities if not a.get("ideal_months") or month in a.get("ideal_months", [])]

    return {"activities": activities}

@router.post("/sub-destinations/{sub_dest_id}/image")
async def update_sub_destination_stock_image(
    sub_dest_id: str,
    payload: SubDestImagePayload,
    user: Any = Depends(verify_token_optional)
):
    """
    Global Stock Image Auto-Association:
    When an agent selects a stock photo (Unsplash/Pexels) for a sub-destination,
    persist it to the global catalog so future uses auto-populate the image.
    Device uploads (image_source == 'user') are excluded to prevent copyright issues.
    """
    if payload.image_source != "stock":
        return {"success": False, "message": "Only stock photos are saved to global catalog for copyright safety."}

    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=500, detail="Database uninitialized")

    res = sb.table("sub_destinations").update({
        "hero_image_url": payload.image_url,
        "updated_at": "now()"
    }).eq("id", sub_dest_id).execute()

    return {"success": True, "message": "Stock image saved to global catalog.", "data": res.data}

@router.post("/activities/{activity_id}/image")
async def update_activity_stock_image(
    activity_id: str,
    payload: ActivityImagePayload,
    user: Any = Depends(verify_token_optional)
):
    """
    Global Stock Image Auto-Association:
    Persists stock image URL for an activity to the global catalog.
    """
    if payload.image_source != "stock":
        return {"success": False, "message": "Only stock photos are saved to global catalog for copyright safety."}

    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=500, detail="Database uninitialized")

    res = sb.table("destination_activities").update({
        "image_url": payload.image_url,
        "image_source": "stock",
        "updated_at": "now()"
    }).eq("id", activity_id).execute()

    return {"success": True, "message": "Stock image saved to global catalog.", "data": res.data}

@router.post("/import")
async def import_destination_knowledge(
    items: List[ImportDestinationItem],
    user: Any = Depends(verify_token_optional)
):
    """
    Dynamic data-driven import endpoint for expanding destinations, sub-destinations, and activities via API or CSV.
    """
    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=500, detail="Database uninitialized")

    imported_count = 0
    for item in items:
        try:
            # 1. Upsert Destination
            dest_res = sb.table("destinations").upsert({
                "name": item.destination.strip(),
                "state_or_ut": item.state_or_ut or "India",
                "region": item.region or "India"
            }, on_conflict="name").execute()
            
            dest_id = None
            if dest_res.data:
                dest_id = dest_res.data[0]["id"]
            else:
                d_find = sb.table("destinations").select("id").eq("name", item.destination.strip()).single().execute()
                dest_id = d_find.data["id"]

            # 2. Upsert Sub-destination
            sub_res = sb.table("sub_destinations").upsert({
                "destination_id": dest_id,
                "name": item.sub_destination.strip(),
                "type": item.sub_dest_type or "town"
            }, on_conflict="destination_id,name").execute()

            sub_id = None
            if sub_res.data:
                sub_id = sub_res.data[0]["id"]
            else:
                s_find = sb.table("sub_destinations").select("id").eq("destination_id", dest_id).eq("name", item.sub_destination.strip()).single().execute()
                sub_id = s_find.data["id"]

            # 3. Insert Activity
            sb.table("destination_activities").insert({
                "sub_destination_id": sub_id,
                "name": item.activity_name.strip(),
                "category": item.category or "Sightseeing",
                "estimated_duration_hours": item.duration_hours or 2.0,
                "ideal_time_of_day": item.ideal_time_of_day or "Morning",
                "description": item.description or "",
                "image_url": item.image_url
            }).execute()

            imported_count += 1
        except Exception as e:
            logger.error(f"[ImportDestinations] Failed row {item.destination}/{item.sub_destination}: {e}")

    return {"success": True, "imported_records": imported_count}
