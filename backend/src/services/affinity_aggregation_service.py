"""
affinity_aggregation_service.py — Nightly/on-demand aggregation of activity_logs into object_affinity.
"""
import logging
from src.services.supabase_client import get_supabase_client

from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

def aggregate_affinity() -> bool:
    """
    Aggregates unaggregated activity_logs into object_affinity.
    Computes score = (times_added * 1.5) - (times_rejected * 3.0)
    Marks aggregated activity_logs rows with aggregated_at = NOW().
    """
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured")
        return False

    try:
        # 1. Fetch relevant log records that have not yet been aggregated
        actions = ["suggestion_shown", "suggestion_added", "suggestion_rejected", "item_deleted_after_add"]
        try:
            res = sb.table("activity_logs").select("id, agency_id, action, entity_id").in_("action", actions).is_("aggregated_at", "null").execute()
        except Exception:
            # Fallback if column not migrated yet
            res = sb.table("activity_logs").select("id, agency_id, action, entity_id").in_("action", actions).execute()
        
        logs = res.data or []
        if not logs:
            logger.info("No activity logs found to aggregate.")
            return True

        # Group by (agency_id, object_id)
        groups = {}
        log_ids = []
        for log in logs:
            if "id" in log and log["id"]:
                log_ids.append(log["id"])
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

        # 3. Mark processed log rows as aggregated
        now_str = datetime.now(timezone.utc).isoformat()
        for log_id in log_ids:
            try:
                sb.table("activity_logs").update({"aggregated_at": now_str}).eq("id", log_id).execute()
            except Exception as e:
                logger.warning(f"Failed to set aggregated_at for log {log_id}: {e}")
            
        logger.info(f"Successfully aggregated affinity scores for {len(groups)} objects ({len(log_ids)} logs marked aggregated).")
        return True
    except Exception as e:
        logger.exception("Failed to aggregate affinity scores")
        return False


def run_activity_logs_retention(retention_days: int = 60) -> dict:
    """
    Runs affinity_aggregation_service first, then deletes activity_logs rows older
    than retention_days that have already been aggregated (aggregated_at IS NOT NULL).
    Never deletes unaggregated rows.
    """
    sb = get_supabase_client()
    if not sb:
        return {"status": "error", "message": "Supabase client not configured", "deleted_count": 0}

    logger.info(f"Running activity_logs retention job (retention_days={retention_days})...")

    # Step 1: Run affinity aggregation first
    aggregation_success = aggregate_affinity()

    # Also mark non-affinity logs older than retention_days as aggregated so they can be cleaned up
    try:
        now_str = datetime.now(timezone.utc).isoformat()
        actions = ["suggestion_shown", "suggestion_added", "suggestion_rejected", "item_deleted_after_add"]
        sb.table("activity_logs").update({"aggregated_at": now_str}).is_("aggregated_at", "null").not_.in_("action", actions).execute()
    except Exception as e:
        logger.warning(f"Failed to mark non-affinity logs as aggregated: {e}")

    # Step 2: Delete rows older than retention_days that have aggregated_at IS NOT NULL
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
    deleted_count = 0

    try:
        res = sb.table("activity_logs").delete().not_.is_("aggregated_at", "null").lt("created_at", cutoff).execute()
        deleted_rows = res.data or []
        deleted_count = len(deleted_rows)
        logger.info(f"Retention cleanup complete. Deleted {deleted_count} aggregated activity_logs older than {retention_days} days.")
    except Exception as e:
        logger.error(f"Failed to delete old aggregated activity_logs: {e}")

    return {
        "status": "success" if aggregation_success else "partial_success",
        "aggregation_ran": aggregation_success,
        "retention_days": retention_days,
        "deleted_count": deleted_count
    }

