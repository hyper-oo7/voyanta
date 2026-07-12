-- Migration: 20260713000001_razorpay_subscriptions_and_entitlements.sql
-- Purpose: Add Razorpay subscription fields, immutable compliance/payment audit tables, and tier entitlement helpers

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT,
    ADD COLUMN IF NOT EXISTS monthly_proposals_used INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_cycle_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub_id ON public.subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- 1. Immutable compliance consent logs (DPDP Act 2023 compliance & terms approvals - NEVER DELETED)
CREATE TABLE IF NOT EXISTS public.compliance_consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    consent_type TEXT NOT NULL, -- e.g. 'dpdp_privacy_cookie', 'terms_acceptance'
    consent_payload JSONB NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_agency ON public.compliance_consent_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_compliance_consent_created ON public.compliance_consent_logs(created_at);

-- 2. Immutable billing & payment logs (Permanent audit record of every payment and subscription action)
CREATE TABLE IF NOT EXISTS public.billing_payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- e.g. 'subscription_created', 'payment_verified', 'webhook_charged'
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount_inr NUMERIC DEFAULT 0,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_agency ON public.billing_payment_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_razorpay_id ON public.billing_payment_logs(razorpay_payment_id);

-- 3. Entitlements lookup helper function
CREATE OR REPLACE FUNCTION public.get_agency_entitlements(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub public.subscriptions%ROWTYPE;
    v_plan TEXT;
    v_result JSONB;
BEGIN
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE agency_id = p_agency_id;

    IF NOT FOUND THEN
        -- Return Starter fallback if no subscription row exists yet
        RETURN jsonb_build_object(
            'plan', 'Starter',
            'status', 'active',
            'max_proposals_per_month', 50,
            'monthly_proposals_used', 0,
            'allowed_template_tiers', jsonb_build_array('Basic'),
            'features', jsonb_build_object(
                'ai_vault', true,
                'ai_rewrite', false,
                'ai_proposal_review', false,
                'ai_curated_itinerary', false,
                'ai_cost_optimizer', false,
                'crm', true,
                'invoicing', true
            )
        );
    END IF;

    v_plan := COALESCE(v_sub.plan, 'Starter');

    IF v_plan = 'Starter' THEN
        v_result := jsonb_build_object(
            'plan', 'Starter',
            'status', COALESCE(v_sub.status, 'active'),
            'max_proposals_per_month', 50,
            'monthly_proposals_used', COALESCE(v_sub.monthly_proposals_used, 0),
            'allowed_template_tiers', jsonb_build_array('Basic'),
            'features', jsonb_build_object(
                'ai_vault', true,
                'ai_rewrite', false,
                'ai_proposal_review', false,
                'ai_curated_itinerary', false,
                'ai_cost_optimizer', false,
                'crm', true,
                'invoicing', true
            )
        );
    ELSIF v_plan = 'Professional' THEN
        v_result := jsonb_build_object(
            'plan', 'Professional',
            'status', COALESCE(v_sub.status, 'active'),
            'max_proposals_per_month', 200,
            'monthly_proposals_used', COALESCE(v_sub.monthly_proposals_used, 0),
            'allowed_template_tiers', jsonb_build_array('Basic', 'Premium'),
            'features', jsonb_build_object(
                'ai_vault', true,
                'ai_rewrite', true,
                'ai_proposal_review', true,
                'ai_curated_itinerary', false,
                'ai_cost_optimizer', false,
                'crm', true,
                'invoicing', true
            )
        );
    ELSE
        -- Professional Plus or Enterprise (Unlimited proposals, all AI tools, all templates)
        v_result := jsonb_build_object(
            'plan', v_plan,
            'status', COALESCE(v_sub.status, 'active'),
            'max_proposals_per_month', -1,
            'monthly_proposals_used', COALESCE(v_sub.monthly_proposals_used, 0),
            'allowed_template_tiers', jsonb_build_array('Basic', 'Premium', 'Enterprise'),
            'features', jsonb_build_object(
                'ai_vault', true,
                'ai_rewrite', true,
                'ai_proposal_review', true,
                'ai_curated_itinerary', true,
                'ai_cost_optimizer', true,
                'crm', true,
                'invoicing', true,
                'multi_agent', (v_plan = 'Enterprise')
            )
        );
    END IF;

    RETURN v_result;
END;
$$;
