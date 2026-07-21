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
  const [entitlement, setEntitlement] = useState(() => {
    const storedPlan = typeof window !== 'undefined' ? (localStorage.getItem('voyanta_active_plan') || localStorage.getItem('voyanta_pending_subscription_plan') || localStorage.getItem('voyanta_user_plan')) : null;
    if (storedPlan && storedPlan.toLowerCase() !== 'starter') {
      const formatted = storedPlan.charAt(0).toUpperCase() + storedPlan.slice(1);
      return {
        ...DEFAULT_ENTITLEMENT,
        plan: formatted,
        allowed_template_tiers: ['Basic', 'Premium', 'Bespoke', 'Luxury', 'Enterprise'],
        features: {
          ...DEFAULT_ENTITLEMENT.features,
          ai_rewrite: true,
          ai_proposal_review: true,
          ai_curated_itinerary: true,
          ai_cost_optimizer: true
        }
      };
    }
    return DEFAULT_ENTITLEMENT;
  });
  const [loading, setLoading] = useState(false);

  const fetchEntitlement = useCallback(async () => {
    setLoading(true);
    const storedPlan = typeof window !== 'undefined' ? (localStorage.getItem('voyanta_active_plan') || localStorage.getItem('voyanta_pending_subscription_plan') || localStorage.getItem('voyanta_user_plan')) : null;
    try {
      const res = await fetch('/api/billing/entitlements?agency_id=demo-agency-id');
      if (res.ok) {
        const data = await res.json();
        if (storedPlan && storedPlan.toLowerCase() !== 'starter') {
          data.plan = storedPlan.charAt(0).toUpperCase() + storedPlan.slice(1);
          data.allowed_template_tiers = ['Basic', 'Premium', 'Bespoke', 'Luxury', 'Enterprise'];
          data.features = {
            ...data.features,
            ai_rewrite: true,
            ai_proposal_review: true,
            ai_curated_itinerary: true,
            ai_cost_optimizer: true
          };
        }
        setEntitlement(data);
        return;
      }
    } catch (err) {
      console.warn('Using fallback entitlement:', err);
    } finally {
      if (storedPlan && storedPlan.toLowerCase() !== 'starter') {
        const formatted = storedPlan.charAt(0).toUpperCase() + storedPlan.slice(1);
        setEntitlement(prev => ({
          ...prev,
          plan: formatted,
          allowed_template_tiers: ['Basic', 'Premium', 'Bespoke', 'Luxury', 'Enterprise'],
          features: {
            ...prev.features,
            ai_rewrite: true,
            ai_proposal_review: true,
            ai_curated_itinerary: true,
            ai_cost_optimizer: true
          }
        }));
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlement();
    const handler = () => fetchEntitlement();
    window.addEventListener('voyanta:plan-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('voyanta:plan-updated', handler);
      window.removeEventListener('storage', handler);
    };
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
