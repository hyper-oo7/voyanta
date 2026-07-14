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

# Fallback when DB lookup fails (fail-closed for paid/sensitive features)
FAIL_CLOSED_ENTITLEMENT = {
    "plan": "Starter",
    "status": "active",
    "max_proposals_per_month": 0,
    "monthly_proposals_used": 0,
    "allowed_template_tiers": ["Basic"],
    "features": {
        "ai_vault": False,  # disabled
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
    Fetches entitlement data for an agency from Postgres.

    Three distinct outcomes:
      - No agency_id / no db connection:
          Returns FAIL_CLOSED_ENTITLEMENT (all gated features disabled).
          This is NOT the same as Starter — a caller with no agency context
          should never receive ai_vault access via a silent default.

      - RPC succeeds but returns empty data (agency row not yet created):
          Returns DEFAULT_STARTER_ENTITLEMENT.  A real agency that just signed
          up may not have an entitlements row yet; Starter is the correct default.

      - RPC raises an exception (network error, timeout, Supabase blip):
          Raises HTTP 503 Service Unavailable.  A transient infrastructure error
          must NOT silently grant permissions — callers must retry or surface the
          error to the user.  Fail-open on a DB blip is a security defect.
    """
    if not db or not agency_id:
        # No verifiable agency context — deny gated features rather than
        # silently grant them.  Demo mode sets agency_id explicitly so it
        # follows the normal RPC path and gets real (or Starter) entitlements.
        logger.warning(
            f"[Entitlements] No agency_id or db — returning fail-closed entitlement. "
            f"agency_id={agency_id!r}"
        )
        return FAIL_CLOSED_ENTITLEMENT

    try:
        res = await db.rpc("get_agency_entitlements", {"p_agency_id": agency_id}).execute()
    except Exception as e:
        # RPC threw — this is an infrastructure error, not a business-logic "not found".
        # Raising 503 ensures the caller knows the request cannot be safely authorised
        # right now rather than proceeding with silently-downgraded permissions.
        logger.error(
            f"[Entitlements] RPC call failed for agency_id={agency_id!r}: {e}. "
            f"Returning 503 — do NOT silently grant or deny access on a transient error."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "entitlements_unavailable",
                "message": (
                    "Could not verify your subscription entitlements due to a temporary "
                    "service issue. Please retry in a few seconds."
                ),
            },
        )

    if res and res.data:
        return res.data

    # RPC succeeded but no row found → agency exists but has no entitlements row yet.
    # Starter is the correct business default for a newly-created agency.
    logger.info(
        f"[Entitlements] No entitlements row found for agency_id={agency_id!r}. "
        f"Returning DEFAULT_STARTER_ENTITLEMENT."
    )
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
