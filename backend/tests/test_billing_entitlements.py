"""
test_billing_entitlements.py
============================
Tests Razorpay subscription creation, HMAC signature verification, and tiered entitlement gating.
"""
import pytest
from fastapi import HTTPException
from src.services.billing_service import create_subscription_order, verify_razorpay_signature
from src.core.entitlements import check_feature_entitlement, check_template_entitlement

def test_razorpay_subscription_order_creation():
    order = create_subscription_order("agency_999", "professional")
    assert order["amount_inr"] == 2999
    assert order["currency"] == "INR"
    assert order["plan_name"] == "Professional Plan"
    assert order["subscription_id"].startswith("sub_professional_")

def test_razorpay_signature_verification_mock():
    assert verify_razorpay_signature("pay_1", "sub_1", "mock_signature") is True

def test_feature_entitlement_gating_blocks_starter():
    starter_entitlement = {
        "plan": "Starter",
        "features": {
            "ai_vault": True,
            "ai_rewrite": False
        }
    }
    with pytest.raises(HTTPException) as exc_info:
        check_feature_entitlement(starter_entitlement, "ai_rewrite")
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"] == "upgrade_required"

def test_template_entitlement_gating_blocks_premium_on_starter():
    starter_entitlement = {
        "plan": "Starter",
        "allowed_template_tiers": ["Basic"]
    }
    # Basic tier template check should pass silently
    check_template_entitlement(starter_entitlement, "Basic")

    # Premium tier template check should raise 403
    with pytest.raises(HTTPException) as exc_info:
        check_template_entitlement(starter_entitlement, "Premium")
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["template_tier"] == "Premium"
