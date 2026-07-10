"""
validation_service.py — Pure business logic checking for proposal warnings (repetition, budget, logistics, pacing).
"""
import logging
from typing import List, Dict, Any, Set
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Configurable constants
BUDGET_OVER_PERCENTAGE = 0.10  # 10% threshold
MAX_ACTIVITIES_PER_DAY = 4

def check_repetition(items: List[Dict[str, Any]], resolved_objs: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Flags if the same activity category or object type appears on 3+ consecutive days.
    """
    warnings = []
    
    # 1. Map items to days and resolve their categories
    day_categories: Dict[int, Set[str]] = {}
    for it in items:
        meta = it.get("meta") or {}
        day = meta.get("day")
        if day is None:
            continue
        try:
            day = int(day)
        except (ValueError, TypeError):
            continue
            
        ref_id = it.get("ref_id")
        # Resolve category
        category = it.get("kind") or "unknown"
        if ref_id in resolved_objs:
            obj = resolved_objs[ref_id]
            category = obj.get("object_type") or category
            
        if day not in day_categories:
            day_categories[day] = set()
        day_categories[day].add(category.lower())
        
    if not day_categories:
        return warnings

    # 2. Check for 3+ consecutive days
    days_sorted = sorted(day_categories.keys())
    if len(days_sorted) < 3:
        return warnings

    flagged_categories = set()
    
    # Scan consecutive window of days
    for i in range(len(days_sorted) - 2):
        d1, d2, d3 = days_sorted[i], days_sorted[i+1], days_sorted[i+2]
        # Must be consecutive calendar days (e.g. Day 1, Day 2, Day 3)
        if d2 == d1 + 1 and d3 == d2 + 1:
            common = day_categories[d1].intersection(day_categories[d2]).intersection(day_categories[d3])
            # Exclude standard categories like 'hotel' or 'transfer' which are naturally consecutive
            common = {c for c in common if c not in ("hotel", "transfer")}
            for cat in common:
                if cat not in flagged_categories:
                    flagged_categories.add(cat)
                    
                    # Find affected item IDs
                    affected_ids = []
                    for it in items:
                        meta = it.get("meta") or {}
                        it_day = meta.get("day")
                        if it_day in (d1, d2, d3):
                            ref_id = it.get("ref_id")
                            it_cat = it.get("kind") or "unknown"
                            if ref_id in resolved_objs:
                                it_cat = resolved_objs[ref_id].get("object_type") or it_cat
                            if it_cat.lower() == cat:
                                affected_ids.append(it["id"])
                                
                    warnings.append({
                        "rule": "repetition",
                        "severity": "warning",
                        "message": f"Repetitive pacing: activity type '{cat}' is scheduled on 3 consecutive days (Days {d1}, {d2}, and {d3}).",
                        "affected_item_ids": affected_ids
                    })
                    
    return warnings


def check_budget(items: List[Dict[str, Any]], brief: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Flags if proposal total cost exceeds brief budget by more than 10%.
    """
    warnings = []
    
    # Extract budget
    budget = float(brief.get("budget") or brief.get("budget_max") or 0.0)
    if budget <= 0:
        return warnings
        
    # Sum total proposal items cost
    total_cost = sum(float(it.get("unit_price") or 0.0) * float(it.get("qty") or 1.0) for it in items)
    
    if total_cost > budget * (1.0 + BUDGET_OVER_PERCENTAGE):
        pct_over = ((total_cost - budget) / budget) * 100.0
        warnings.append({
            "rule": "budget",
            "severity": "warning",
            "message": f"Total cost ({total_cost:,.2f}) exceeds the stated budget ({budget:,.2f}) by {pct_over:.1f}%.",
            "affected_item_ids": [it["id"] for it in items]
        })
        
    return warnings


def check_logistics(items: List[Dict[str, Any]], resolved_objs: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Flags if items on the same day have different destination/area and no transfer item is scheduled on that day.
    """
    warnings = []
    
    # Group items by day
    by_day: Dict[int, List[Dict[str, Any]]] = {}
    for it in items:
        meta = it.get("meta") or {}
        day = meta.get("day")
        if day is None:
            continue
        try:
            day = int(day)
        except (ValueError, TypeError):
            continue
        if day not in by_day:
            by_day[day] = []
        by_day[day].append(it)
        
    for day, day_items in by_day.items():
        # Check if there is any transfer scheduled on this day
        has_transfer = any(it.get("kind") == "transfer" for it in day_items)
        if has_transfer:
            continue
            
        # Collect locations for items on this day
        locations = []
        for it in day_items:
            ref_id = it.get("ref_id")
            if ref_id in resolved_objs:
                obj = resolved_objs[ref_id]
                dest = obj.get("destination")
                area = obj.get("area")
                if dest or area:
                    locations.append({
                        "id": it["id"],
                        "label": it.get("label") or "Item",
                        "destination": dest,
                        "area": area
                    })
                    
        # Compare all pairs on this day
        flagged_pairs = set()
        for i in range(len(locations)):
            for j in range(i + 1, len(locations)):
                loc1 = locations[i]
                loc2 = locations[j]
                
                # Check for mismatch
                mismatch = False
                reason = ""
                
                if loc1["destination"] and loc2["destination"] and loc1["destination"].lower() != loc2["destination"].lower():
                    mismatch = True
                    reason = f"different destinations ({loc1['destination']} vs {loc2['destination']})"
                elif loc1["area"] and loc2["area"] and loc1["area"].lower() != loc2["area"].lower():
                    mismatch = True
                    reason = f"different areas ({loc1['area']} vs {loc2['area']})"
                    
                if mismatch:
                    pair_key = tuple(sorted([loc1["id"], loc2["id"]]))
                    if pair_key not in flagged_pairs:
                        flagged_pairs.add(pair_key)
                        warnings.append({
                            "rule": "logistics",
                            "severity": "warning",
                            "message": f"Logistics mismatch on Day {day}: '{loc1['label']}' and '{loc2['label']}' are in {reason} with no transfer between them.",
                            "affected_item_ids": [loc1["id"], loc2["id"]]
                        })
                        
    return warnings


def check_pacing(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Flags if any day has more than MAX_ACTIVITIES_PER_DAY activity items scheduled.
    """
    warnings = []
    
    # Count activity items per day
    activity_counts: Dict[int, List[str]] = {}
    for it in items:
        if it.get("kind") != "activity":
            continue
        meta = it.get("meta") or {}
        day = meta.get("day")
        if day is None:
            continue
        try:
            day = int(day)
        except (ValueError, TypeError):
            continue
            
        if day not in activity_counts:
            activity_counts[day] = []
        activity_counts[day].append(it["id"])
        
    for day, affected_ids in activity_counts.items():
        if len(affected_ids) > MAX_ACTIVITIES_PER_DAY:
            warnings.append({
                "rule": "pacing",
                "severity": "warning",
                "message": f"Pacing check: Day {day} has {len(affected_ids)} activities scheduled, which exceeds the recommended limit of {MAX_ACTIVITIES_PER_DAY}.",
                "affected_item_ids": affected_ids
            })
            
    return warnings


def validate_proposal_itinerary(proposal_id: str) -> List[Dict[str, Any]]:
    """
    Queries proposal_items and checks all four validation rules.
    """
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured")
        return []
        
    # 1. Fetch proposal to get brief
    prop_res = sb.table("proposals").select("*").eq("id", proposal_id).execute()
    if not prop_res.data:
        return []
    proposal = prop_res.data[0]
    brief = proposal.get("brief") or {}
    
    # 2. Fetch proposal items
    items_res = sb.table("proposal_items").select("*").eq("proposal_id", proposal_id).execute()
    items = items_res.data or []
    
    # 3. Resolve knowledge objects for ref_ids
    ref_ids = [it["ref_id"] for it in items if it.get("ref_id")]
    resolved_objs = {}
    if ref_ids:
        objs_res = sb.table("knowledge_objects").select("id, object_type, destination, area").in_("id", ref_ids).execute()
        for o in (objs_res.data or []):
            resolved_objs[o["id"]] = o
            
    # 4. Run checking checks
    warnings = []
    warnings.extend(check_repetition(items, resolved_objs))
    warnings.extend(check_budget(items, brief))
    warnings.extend(check_logistics(items, resolved_objs))
    warnings.extend(check_pacing(items))
    
    return warnings
