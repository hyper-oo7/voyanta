import React, { useState } from 'react';

export default function UpgradePlanModal({ isOpen, onClose, lockedItemName, onUpgradeSuccess }) {
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const getPriceInr = (plan) => {
    if (plan === 'professional') {
      return billingCycle === 'yearly' ? 2399 : 2999;
    }
    return billingCycle === 'yearly' ? 3199 : 3999;
  };

  const handleRazorpayCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Create subscription order
      const orderRes = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_slug: selectedPlan,
          billing_cycle: billingCycle,
          agency_id: 'demo-agency-id'
        })
      });

      if (!orderRes.ok) {
        throw new Error('Failed to initialize Razorpay order');
      }

      const orderData = await orderRes.json();

      // Step 2: Verify payment (using mock verification signature for instant test/demo)
      const verifyRes = await fetch('/api/billing/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_id: 'demo-agency-id',
          plan_slug: selectedPlan,
          razorpay_payment_id: `pay_${Date.now()}`,
          razorpay_subscription_id: orderData.subscription_id,
          razorpay_signature: 'mock_signature',
          amount_inr: getPriceInr(selectedPlan)
        })
      });

      if (!verifyRes.ok) {
        throw new Error('Payment signature verification failed');
      }

      const result = await verifyRes.json();
      if (onUpgradeSuccess) onUpgradeSuccess(result.plan);
      onClose();
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-outline-variant shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-primary/10 via-surface to-primary/5 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-on-surface">
                Unlock {lockedItemName || 'Premium Feature'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Available exclusively on Professional & Professional Plus plans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Billing Cycle Switch */}
        <div className="px-6 pt-5 flex justify-center">
          <div className="inline-flex items-center p-1 bg-surface-container-low border border-outline-variant rounded-xl shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Selector Cards */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Professional Card */}
            <div
              onClick={() => setSelectedPlan('professional')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'professional'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-outline-variant bg-surface hover:border-primary/40'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Professional Plan ⭐</span>
                {selectedPlan === 'professional' && (
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display font-bold text-3xl text-on-surface">
                  ₹{billingCycle === 'yearly' ? '2,399' : '2,999'}
                </span>
                <span className="text-xs text-on-surface-variant">/ month</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mb-3">
                {billingCycle === 'yearly' ? 'Billed ₹28,788 / yr (20% OFF)' : 'Billed monthly'}
              </p>
              <ul className="space-y-1.5 text-xs text-on-surface-variant">
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary text-sm">check</span> 200 proposals / month</li>
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary text-sm">check</span> All 80+ Premium templates unlocked</li>
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary text-sm">check</span> AI Proposal Rewrite & Review</li>
              </ul>
            </div>

            {/* Professional Plus Card */}
            <div
              onClick={() => setSelectedPlan('professional_plus')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'professional_plus'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-outline-variant bg-surface hover:border-primary/40'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Professional Plus Plan</span>
                {selectedPlan === 'professional_plus' && (
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display font-bold text-3xl text-on-surface">
                  ₹{billingCycle === 'yearly' ? '3,199' : '3,999'}
                </span>
                <span className="text-xs text-on-surface-variant">/ month</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mb-3">
                {billingCycle === 'yearly' ? 'Billed ₹38,388 / yr (20% OFF)' : 'Billed monthly'}
              </p>
              <ul className="space-y-1.5 text-xs text-on-surface-variant">
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-600 text-sm">check</span> Unlimited proposals</li>
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-600 text-sm">check</span> All 80+ Premium templates unlocked</li>
                <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-600 text-sm">check</span> AI Itinerary Generation & Cost Optimizer</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* Footer CTA */}
          <div className="pt-4 border-t border-outline-variant flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              🔒 Instant Razorpay INR Checkout • Cancel anytime
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-on-surface-variant hover:text-on-surface border-none bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRazorpayCheckout}
                disabled={loading}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2 border-none cursor-pointer"
              >
                {loading ? 'Processing...' : `Upgrade Now (₹${getPriceInr(selectedPlan).toLocaleString('en-IN')})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
