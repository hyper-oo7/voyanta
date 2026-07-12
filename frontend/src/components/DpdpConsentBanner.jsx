import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DpdpConsentBanner() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const consent = localStorage.getItem('voyanta_dpdp_consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const recordImmutableConsent = async (payload) => {
    try {
      await fetch('/api/billing/record-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_id: 'demo-agency-id',
          consent_type: 'dpdp_privacy_cookie',
          consent_payload: payload
        })
      });
    } catch (err) {
      console.warn('Failed to send consent log to backend:', err);
    }
  };

  const handleAcceptAll = () => {
    const payload = { necessary: true, analytics: true, timestamp: new Date().toISOString() };
    localStorage.setItem('voyanta_dpdp_consent', JSON.stringify(payload));
    recordImmutableConsent(payload);
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    const payload = { necessary: true, analytics: false, timestamp: new Date().toISOString() };
    localStorage.setItem('voyanta_dpdp_consent', JSON.stringify(payload));
    recordImmutableConsent(payload);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-4xl mx-auto bg-surface/90 dark:bg-slate-900/90 backdrop-blur-xl border border-outline-variant rounded-2xl shadow-2xl p-5 sm:p-6 transition-all duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">verified_user</span>
            <h4 className="font-display font-bold text-base text-on-surface">
              Data Privacy & DPDP Act 2023 Consent
            </h4>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            We use strictly necessary session cookies and local storage to secure your agency workspace and provide AI extraction services in full compliance with India's Digital Personal Data Protection Act, 2023. By continuing, you agree to our processing terms.{' '}
            <button
              onClick={() => navigate('/privacy')}
              className="text-primary hover:underline font-medium"
            >
              Privacy Policy
            </button>{' '}
            •{' '}
            <button
              onClick={() => navigate('/cookies')}
              className="text-primary hover:underline font-medium"
            >
              Cookie Notice
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={handleNecessaryOnly}
            className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high rounded-xl border border-outline-variant transition-colors"
          >
            Essential Only
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md shadow-primary/20 hover:shadow-lg transition-all"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
