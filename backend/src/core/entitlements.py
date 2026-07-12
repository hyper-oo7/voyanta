"""
entitlements.py
===============
FastAPI dependencies and entitlement checkers enforcing plan limits and template gating.
"""
from fastapi import HTTPException, status
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Fallback starter entitlement when DB lookup fails or in demo mode
DEFAULT_STARTER_ENTITLEMENT = {
    "plan": "Starter",
    "status": "active",
    "max_proposals_per_month": 50,
    "monthly_proposals_used": 0,
    "allowed_template_tiers": ["Basic"],
    "features": {
        "ai_vault": True,
        "ai_rewrite": False,
        "ai_proposal_review": False,
        "ai_curated_itinerary": False,
        "ai_cost_optimizer": False,
        "crm": True,
        "invoicing": True
    }
}

async def get_agency_entitlements_data(db: Any, agency_id: Optional[str]) -> Dict[str, Any]:
    """
    Fetches entitlement data for an agency from Postgres or returns DEFAULT_STARTER_ENTITLEMENT.
    """
    if not db or not agency_id:
        return DEFAULT_STARTER_ENTITLEMENT
    try:
        res = await db.rpc("get_agency_entitlements", {"p_agency_id": agency_id}).execute()
        if res and res.data:
            return res.data
    except Exception as e:
        logger.warning(f"Error fetching entitlements via RPC: {e}")

    return DEFAULT_STARTER_ENTITLEMENT

def check_feature_entitlement(entitlement: Dict[str, Any], feature_name: str) -> None:
    """
    Raises HTTP 403 if feature_name is not enabled in the agency's current entitlement.
    """
    features = entitlement.get("features", {})
    if not features.get(feature_name, False):
        current_plan = entitlement.get("plan", "Starter")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "upgrade_required",
                "feature": feature_name,
                "current_plan": current_plan,
                "message": f"Feature '{feature_name}' requires upgrading from {current_plan}."
            }
        )

def check_template_entitlement(entitlement: Dict[str, Any], template_tier: str) -> None:
    """
    Raises HTTP 403 if template_tier is not in allowed_template_tiers.
    """
    allowed_tiers = entitlement.get("allowed_template_tiers", ["Basic"])
    if template_tier not in allowed_tiers:
        current_plan = entitlement.get("plan", "Starter")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "upgrade_required",
                "template_tier": template_tier,
                "current_plan": current_plan,
                "message": f"Template tier '{template_tier}' is locked on {current_plan}. Please upgrade to Professional or higher."
            }
        )
