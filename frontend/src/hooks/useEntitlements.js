import { useState, useEffect, useCallback } from 'react';

const DEFAULT_ENTITLEMENT = {
  plan: 'Starter',
  status: 'active',
  max_proposals_per_month: 50,
  monthly_proposals_used: 0,
  allowed_template_tiers: ['Basic'],
  features: {
    ai_vault: true,
    ai_rewrite: false,
    ai_proposal_review: false,
    ai_curated_itinerary: false,
    ai_cost_optimizer: false,
    crm: true,
    invoicing: true
  }
};

export function useEntitlements() {
  const [entitlement, setEntitlement] = useState(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(false);

  const fetchEntitlement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/entitlements?agency_id=demo-agency-id');
      if (res.ok) {
        const data = await res.json();
        setEntitlement(data);
      }
    } catch (err) {
      console.warn('Using default Starter entitlement fallback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlement();
  }, [fetchEntitlement]);

  const canUseFeature = useCallback((featureName) => {
    return Boolean(entitlement?.features?.[featureName]);
  }, [entitlement]);

  const canUseTemplate = useCallback((templateTier) => {
    if (!templateTier || templateTier === 'Basic') return true;
    const allowed = entitlement?.allowed_template_tiers || ['Basic'];
    return allowed.includes(templateTier);
  }, [entitlement]);

  const proposalsRemaining = useCallback(() => {
    if (entitlement.max_proposals_per_month === -1) return 'Unlimited';
    return Math.max(0, entitlement.max_proposals_per_month - (entitlement.monthly_proposals_used || 0));
  }, [entitlement]);

  return {
    entitlement,
    plan: entitlement.plan || 'Starter',
    loading,
    canUseFeature,
    canUseTemplate,
    proposalsRemaining,
    refreshEntitlement: fetchEntitlement
  };
}
