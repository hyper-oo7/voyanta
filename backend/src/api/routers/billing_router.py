"""
billing_router.py
=================
FastAPI router for Razorpay billing, subscription verification, and immutable DPDP consent logs.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from ...services.billing_service import (
    PLAN_CONFIG,
    create_subscription_order,
    verify_razorpay_signature,
    record_payment_log,
    record_consent_log,
)
from ...core.entitlements import get_agency_entitlements_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["Billing & Entitlements"])

class CreateSubscriptionRequest(BaseModel):
    plan_slug: str
    agency_id: Optional[str] = "demo-agency-id"

class VerifyPaymentRequest(BaseModel):
    agency_id: Optional[str] = "demo-agency-id"
    plan_slug: str
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str
    amount_inr: float = 2999

class RecordConsentRequest(BaseModel):
    agency_id: Optional[str] = None
    user_id: Optional[str] = None
    consent_type: str
    consent_payload: Dict[str, Any]

@router.get("/plans")
async def get_plans():
    return {"plans": PLAN_CONFIG}

@router.get("/entitlements")
async def get_entitlements(agency_id: str = "demo-agency-id"):
    # In full production this reads db session; returns defaults if db uninitialized
    return await get_agency_entitlements_data(db=None, agency_id=agency_id)

@router.post("/create-subscription")
async def create_subscription(payload: CreateSubscriptionRequest):
    order = create_subscription_order(payload.agency_id or "demo-agency-id", payload.plan_slug)
    await record_payment_log(
        db=None,
        agency_id=payload.agency_id,
        event_type="subscription_order_created",
        razorpay_order_id=order["subscription_id"],
        razorpay_payment_id=None,
        razorpay_signature=None,
        amount_inr=order["amount_inr"],
        status="pending",
        metadata={"plan_slug": payload.plan_slug}
    )
    return order

@router.post("/verify-payment")
async def verify_payment(payload: VerifyPaymentRequest):
    is_valid = verify_razorpay_signature(
        payload.razorpay_payment_id,
        payload.razorpay_subscription_id,
        payload.razorpay_signature
    )
    if not is_valid:
        await record_payment_log(
            db=None,
            agency_id=payload.agency_id,
            event_type="payment_verification_failed",
            razorpay_order_id=payload.razorpay_subscription_id,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_signature=payload.razorpay_signature,
            amount_inr=payload.amount_inr,
            status="failed"
        )
        raise HTTPException(status_code=400, detail="Invalid Razorpay signature verification")

    # Record permanent immutable success audit log
    await record_payment_log(
        db=None,
        agency_id=payload.agency_id,
        event_type="payment_verified_and_upgraded",
        razorpay_order_id=payload.razorpay_subscription_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
        amount_inr=payload.amount_inr,
        status="verified",
        metadata={"plan_slug": payload.plan_slug}
    )

    return {
        "status": "success",
        "message": f"Successfully verified Razorpay payment and upgraded to {payload.plan_slug}",
        "plan": PLAN_CONFIG.get(payload.plan_slug, {}).get("plan_name_db", "Professional")
    }

@router.post("/record-consent")
async def record_consent(payload: RecordConsentRequest, request: Request):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    await record_consent_log(
        db=None,
        agency_id=payload.agency_id,
        user_id=payload.user_id,
        consent_type=payload.consent_type,
        consent_payload=payload.consent_payload,
        ip_address=client_ip,
        user_agent=user_agent
    )
    return {"status": "recorded", "consent_type": payload.consent_type}
