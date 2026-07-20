import logging
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

BUDGET_MID_MIN = 2000.0
BUDGET_LUXURY_MIN = 8000.0

def infer_proposal_criteria(proposal_data: dict) -> dict:
    """
    Infers criteria like destination, price_tier, audience_tags, and travel_month from proposal details.
    """
    brief = proposal_data.get("brief") or {}
    destination = proposal_data.get("destination") or brief.get("destination")

    try:
        adults = int(brief.get("num_adults") or brief.get("adults") or proposal_data.get("travelers") or 2)
    except Exception:
        adults = 2

    try:
        children = int(brief.get("num_children") or brief.get("children") or 0)
    except Exception:
        children = 0

    try:
        budget = float(brief.get("budget") or proposal_data.get("budget_max") or 0)
    except Exception:
        budget = 0.0

    # Map budget to price_tier
    price_tier = "budget"
    if budget >= BUDGET_LUXURY_MIN:
        price_tier = "luxury"
    elif budget >= BUDGET_MID_MIN:
        price_tier = "mid"

    # Map travelers and framing notes to audience tags
    search_text = " ".join([
        proposal_data.get("name") or "",
        brief.get("notes") or "",
        brief.get("special_notes") or "",
        str(proposal_data.get("preferences") or "")
    ]).lower()
    
    romantic_keywords = {"honeymoon", "romantic", "anniversary", "couple", "husband", "wife", "spouse"}
    is_romantic = any(kw in search_text for kw in romantic_keywords)
    
    if children > 0:
        audience_tags = {"family", "kids"}
    elif is_romantic:
        audience_tags = {"couple", "honeymoon"}
    else:
        if adults == 1:
            audience_tags = {"solo"}
        elif adults == 2:
            audience_tags = {"couple"}
        else:
            audience_tags = {"group"}

    # Extract travel month from start date
    start_date = proposal_data.get("start_date") or brief.get("start_date") or brief.get("date_start") or brief.get("departure_date")
    travel_month = None
    if start_date:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(start_date.replace("Z", ""))
            travel_month = dt.month
        except Exception:
            if len(start_date) >= 7 and start_date[4] == '-' and start_date[7] == '-':
                try:
                    travel_month = int(start_date[5:7])
                except ValueError:
                    pass

    return {
        "destination": destination,
        "price_tier": price_tier,
        "audience_tags": audience_tags,
        "travel_month": travel_month
    }


def score_candidates(
    objs: List[dict],
    tags_data: List[dict],
    affinity_data: List[dict],
    seasonal_rules: List[dict],
    target_tags: Set[str],
    dislikes_set: Set[str]
) -> List[dict]:
    """
    Pure candidate scoring and ranking logic.
    """
    # Index tags by object_id
    tags_by_obj = {}
    for t in tags_data:
        oid = t["object_id"]
        if oid not in tags_by_obj:
            tags_by_obj[oid] = []
        tags_by_obj[oid].append(t)

    # Index affinity by object_id
    affinity_by_obj = {a["object_id"]: float(a.get("affinity_score") or 0.0) for a in affinity_data}

    ranked = []
    for o in objs:
        oid = o["id"]
        aff_score = affinity_by_obj.get(oid, 0.0)
        
        # Exclude objects where affinity drops below the negative threshold
        if aff_score < -5.0:
            continue

        o_tags = tags_by_obj.get(oid) or []
        o_tag_vals = [t["tag"] for t in o_tags]
        
        # Exclude objects tagged with anything in the client dislikes list
        if dislikes_set and any(t_val.lower() in dislikes_set for t_val in o_tag_vals):
            continue
            
        # Count target tag matches
        matched = [tag_val for tag_val in o_tag_vals if tag_val in target_tags]
        tag_match_count = len(matched)
        
        # Score = (tag_match_count * 2) + affinity_score
        seasonal_penalty = 0.0
        seasonal_boost = 0.0
        
        for rule in seasonal_rules:
            applies_tag = rule.get("applies_to_tag")
            tag_matches = not applies_tag or (applies_tag.lower() in [t.lower() for t in o_tag_vals])
            
            if tag_matches:
                r_type = rule.get("rule_type")
                if r_type == 'avoid':
                    seasonal_penalty += 15.0
                elif r_type == 'prefer':
                    seasonal_boost += 5.0

        score = (tag_match_count * 2.0) + aff_score - seasonal_penalty + seasonal_boost
        
        ranked.append({
            "id": oid,
            "name": o["name"],
            "object_type": o["object_type"],
            "destination": o["destination"],
            "area": o.get("area"),
            "attributes": o.get("attributes") or {},
            "matched_tags": matched,
            "score": score,
            "tags": [{"tag_category": t["tag_category"], "tag": t["tag"]} for t in o_tags]
        })

    # Sort in descending order of matching score
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


async def get_proposal_suggestions_service(
    sb: Any,
    proposal_id: str,
    step: str,
    agency_id: Optional[str] = None,
    destination_fallback: Optional[str] = None
) -> dict:
    """
    Main suggestion flow coordinating data fetching, candidate inference, ranking, and related suggestions.
    """
    # 1. Fetch proposal to extract destination and client brief criteria
    proposal_res = sb.table("proposals").select("*").eq("id", proposal_id).execute()
    if not proposal_res.data:
        proposal_data = {
            "id": proposal_id,
            "destination": destination_fallback or "",
            "name": "Draft Proposal",
            "brief": {"destination": destination_fallback or ""}
        }
    else:
        proposal_data = proposal_res.data[0]
    
    # Fetch client preferences (dislikes)
    dislikes_set = set()
    client_id = proposal_data.get("client_id")
    if client_id:
        try:
            client_res = sb.table("clients").select("preferences").eq("id", client_id).execute()
            if client_res.data:
                client_prefs = client_res.data[0].get("preferences") or {}
                if isinstance(client_prefs, dict):
                    dislikes = client_prefs.get("dislikes") or []
                    dislikes_set = {d.lower() for d in dislikes if isinstance(d, str)}
        except Exception as e:
            logger.error(f"Failed to query client preferences for client {client_id}: {e}")

    # Infer criteria
    criteria = infer_proposal_criteria(proposal_data)
    destination = criteria["destination"]
    price_tier = criteria["price_tier"]
    audience_tags = criteria["audience_tags"]
    travel_month = criteria["travel_month"]

    # Fetch sub-destinations dynamically
    sub_destinations = []
    if destination:
        try:
            sub_query = sb.table("knowledge_objects")\
                .select("*")\
                .eq("object_type", "destination")\
                .eq("is_active", True)\
                .ilike("destination", f"%{destination}%")
            if agency_id:
                sub_query = sub_query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
            else:
                sub_query = sub_query.is_("agency_id", "null")
            sub_res = sub_query.execute()
            raw_subs = sub_res.data or []
            dest_lower = (destination or "").lower().strip()
            sub_destinations = []
            for s in raw_subs:
                s_dest = (s.get("destination") or "").lower().strip()
                s_name = (s.get("name") or "").lower().strip()
                s_area = (s.get("area") or "").lower().strip()
                if not dest_lower or (dest_lower in s_dest or s_dest in dest_lower or dest_lower in s_name or dest_lower in s_area):
                    sub_destinations.append(s)
        except Exception as e:
            logger.error(f"Failed to query sub-destinations: {e}")

    # Fetch seasonal rules if destination and month are available
    seasonal_rules = []
    if destination and travel_month:
        try:
            rule_query = sb.table("seasonal_rules").select("*").ilike("destination", f"%{destination}%").eq("month", travel_month)
            if agency_id:
                rule_query = rule_query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
            else:
                rule_query = rule_query.is_("agency_id", "null")
            rules_res = rule_query.execute()
            seasonal_rules = rules_res.data or []
        except Exception as e:
            logger.error(f"Failed to query seasonal rules: {e}")

    # Compile target tags
    target_tags = set(audience_tags)
    target_tags.add(price_tier)

    # Fetch candidates
    obj_type = "hotel" if step == "hotels" else "activity"
    query = sb.table("knowledge_objects").select("*").eq("object_type", obj_type).eq("is_active", True)
    if destination:
        query = query.ilike("destination", f"%{destination}%")
    if agency_id:
        query = query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
    else:
        query = query.is_("agency_id", "null")

    objs_res = query.execute()
    objs = objs_res.data or []

    if not objs:
        return {
            "step": step,
            "proposal_id": proposal_id,
            "inferred_criteria": {
                "destination": destination,
                "price_tier": price_tier,
                "audience_tags": list(audience_tags)
            },
            "suggestions": [],
            "sub_destinations": sub_destinations
        }

    # Fetch tags & affinity
    obj_ids = [o["id"] for o in objs]
    tags_res = sb.table("object_tags").select("*").in_("object_id", obj_ids).execute()
    tags_data = tags_res.data or []

    affinity_res = sb.table("object_affinity").select("*").in_("object_id", obj_ids).execute()
    affinity_data = affinity_res.data or []

    # Score and rank
    ranked_suggestions = score_candidates(
        objs=objs,
        tags_data=tags_data,
        affinity_data=affinity_data,
        seasonal_rules=seasonal_rules,
        target_tags=target_tags,
        dislikes_set=dislikes_set
    )

    # Fetch related suggestions
    related_suggestions = []
    try:
        items_res = sb.table("proposal_items").select("ref_id, label").eq("proposal_id", proposal_id).execute()
        added_items = items_res.data or []
        added_ref_ids = [item["ref_id"] for item in added_items if item.get("ref_id")]
        
        if added_ref_ids:
            relations_res = sb.table("object_relations")\
                .select("object_a_id, object_b_id, relation_type, distance_minutes")\
                .in_("object_a_id", added_ref_ids)\
                .in_("relation_type", ["nearby", "pairs_well_with"])\
                .eq("is_dismissed", False)\
                .execute()
                
            relations_data = relations_res.data or []
            if relations_data:
                related_obj_ids = [r["object_b_id"] for r in relations_data]
                related_obj_ids = [rid for rid in related_obj_ids if rid not in added_ref_ids]
                
                if related_obj_ids:
                    rel_objs_res = sb.table("knowledge_objects")\
                        .select("*")\
                        .in_("id", related_obj_ids)\
                        .eq("is_active", True)\
                        .execute()
                    rel_objs = rel_objs_res.data or []
                    
                    if rel_objs:
                        rel_tags_res = sb.table("object_tags").select("*").in_("object_id", related_obj_ids).execute()
                        rel_tags_data = rel_tags_res.data or []
                        
                        rel_tags_by_obj = {}
                        for t in rel_tags_data:
                            oid = t["object_id"]
                            if oid not in rel_tags_by_obj:
                                rel_tags_by_obj[oid] = []
                            rel_tags_by_obj[oid].append(t)
                        
                        added_labels_map = {item["ref_id"]: item["label"] for item in added_items if item.get("ref_id")}
                        
                        for ro in rel_objs:
                            roid = ro["id"]
                            rel_info = next((r for r in relations_data if r["object_b_id"] == roid), None)
                            
                            if rel_info:
                                ro_tags = rel_tags_by_obj.get(roid) or []
                                based_on_id = rel_info["object_a_id"]
                                based_on_name = added_labels_map.get(based_on_id) or "added item"
                                
                                related_suggestions.append({
                                    "id": roid,
                                    "name": ro["name"],
                                    "object_type": ro["object_type"],
                                    "destination": ro["destination"],
                                    "area": ro.get("area"),
                                    "attributes": ro.get("attributes") or {},
                                    "tags": [{"tag_category": t["tag_category"], "tag": t["tag"]} for t in ro_tags],
                                    "relation": {
                                        "relation_type": rel_info["relation_type"],
                                        "distance_minutes": rel_info["distance_minutes"],
                                        "based_on_id": based_on_id,
                                        "based_on_name": based_on_name
                                    }
                                })
    except Exception as e:
        logger.error(f"Failed to query related suggestions: {e}")

    return {
        "status": "success",
        "step": step,
        "proposal_id": proposal_id,
        "inferred_criteria": {
            "destination": destination,
            "price_tier": price_tier,
            "audience_tags": list(audience_tags),
            "travel_month": travel_month
        },
        "suggestions": ranked_suggestions[:20],
        "related_suggestions": related_suggestions[:10],
        "sub_destinations": sub_destinations
    }
