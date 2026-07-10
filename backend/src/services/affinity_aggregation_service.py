"""
affinity_aggregation_service.py — Nightly/on-demand aggregation of activity_logs into object_affinity.
"""
import logging
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

def aggregate_affinity() -> bool:
    """
    Aggregates activity_logs into object_affinity.
    Computes score = (times_added * 1.5) - (times_rejected * 3.0)
    """
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured")
        return False

    try:
        # 1. Fetch relevant log records
        actions = ["suggestion_shown", "suggestion_added", "suggestion_rejected", "item_deleted_after_add"]
        res = sb.table("activity_logs").select("agency_id, action, entity_id").in_("action", actions).execute()
        
        logs = res.data or []
        if not logs:
            logger.info("No activity logs found to aggregate.")
            return True

        # Group by (agency_id, object_id)
        groups = {}
        for log in logs:
            agency_id = log.get("agency_id")
            object_id = log.get("entity_id")
            action = log.get("action")
            
            if not agency_id or not object_id:
                continue
                
            key = (agency_id, object_id)
            if key not in groups:
                groups[key] = {
                    "times_suggested": 0,
                    "times_added": 0,
                    "times_rejected": 0
                }
                
            if action == "suggestion_shown":
                groups[key]["times_suggested"] += 1
            elif action == "suggestion_added":
                groups[key]["times_added"] += 1
            elif action == "suggestion_rejected" or action == "item_deleted_after_add":
                groups[key]["times_rejected"] += 1

        # 2. Upsert counts and compute affinity score
        for (agency_id, object_id), metrics in groups.items():
            times_suggested = metrics["times_suggested"]
            times_added = metrics["times_added"]
            times_rejected = metrics["times_rejected"]
            
            # Simple scoring formula:
            affinity_score = (times_added * 1.5) - (times_rejected * 3.0)
            
            upsert_data = {
                "agency_id": agency_id,
                "object_id": object_id,
                "times_suggested": times_suggested,
                "times_added": times_added,
                "times_rejected": times_rejected,
                "affinity_score": affinity_score
            }
            
            sb.table("object_affinity").upsert(upsert_data).execute()
            
        logger.info(f"Successfully aggregated affinity scores for {len(groups)} objects.")
        return True
    except Exception as e:
        logger.exception("Failed to aggregate affinity scores")
        return False
