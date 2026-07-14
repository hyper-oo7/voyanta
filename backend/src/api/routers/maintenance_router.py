from fastapi import APIRouter, HTTPException, Query, Depends
import logging
from src.services.affinity_aggregation_service import run_activity_logs_retention
from src.core.security import verify_internal_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

@router.post("/retention")
async def trigger_activity_logs_retention(
    retention_days: int = Query(60, ge=1, le=365),
    _ = Depends(verify_internal_api_key)
):
    """
    Manually or programmatically trigger activity_logs retention cleanup.
    Runs affinity aggregation first, then deletes aggregated logs older than retention_days.
    Never deletes unaggregated logs.
    """
    try:
        result = run_activity_logs_retention(retention_days=retention_days)
        return result
    except Exception as e:
        logger.exception("Maintenance retention endpoint failed")
        raise HTTPException(status_code=500, detail=str(e))
