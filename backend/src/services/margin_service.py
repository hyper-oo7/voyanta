"""
margin_service.py — Full-Budget Agency Pricing & Margin Engine
==============================================================
Calculates proposal pricing across the full budget (hoteles + transfers + activities + extras).
Supports Percentage (%) and Flat (₹) margins, GST/tax, discounts, per-person pricing,
and Itemized vs Total-Only display modes.
"""

from typing import List, Dict, Any, Optional
from src.models.day_module_schema import MarginConfig, CostingBreakdown


def calculate_full_budget_costing(
    net_subtotal: float,
    margin_config: Optional[MarginConfig] = None,
    num_travelers: int = 1,
    currency: str = "INR"
) -> CostingBreakdown:
    """
    Calculates full budget pricing with margins applied over the entire trip subtotal.
    """
    cfg = margin_config or MarginConfig()
    subtotal = max(0.0, float(net_subtotal))
    travelers = max(1, int(num_travelers))

    # 1. Margin Calculation on Full Budget Subtotal
    if cfg.margin_type == "percentage":
        margin_amount = subtotal * (cfg.margin_value / 100.0)
    else:  # flat margin
        margin_amount = float(cfg.margin_value)

    gross_amount = subtotal + margin_amount

    # 2. Tax Calculation on Gross Amount
    tax_rate = max(0.0, float(cfg.tax_rate_percent))
    tax_amount = gross_amount * (tax_rate / 100.0)

    # 3. Discount Application
    discount = max(0.0, float(cfg.discount_amount))
    final_total = max(0.0, (gross_amount + tax_amount) - discount)

    # 4. Per Person Pricing
    price_per_person = round(final_total / travelers, 2)

    return CostingBreakdown(
        net_subtotal=round(subtotal, 2),
        margin_type=cfg.margin_type,
        margin_value=cfg.margin_value,
        margin_amount=round(margin_amount, 2),
        gross_amount=round(gross_amount, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount, 2),
        final_package_total=round(final_total, 2),
        price_per_person=price_per_person,
        currency=currency,
        visibility_mode=cfg.visibility_mode
    )
