import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CookiePolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Navigation */}
        <div className="mb-10 flex items-center justify-between border-b border-outline-variant pb-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Home
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-white text-[18px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-xl text-primary">Voyanta</span>
          </div>
        </div>

        {/* Document Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            Compliance • Cookie Disclosure
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-on-surface tracking-tight mb-4">
            Cookie & Local Storage Policy
          </h1>
          <p className="text-sm text-on-surface-variant">
            Last Updated: July 12, 2026 • Transparent Cookie Governance
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-10 text-on-surface-variant leading-relaxed text-base">
          
          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              1. What Are Cookies & Local Storage?
            </h2>
            <p>
              Cookies are small data text files stored on your browser or device when you visit web applications. Similarly, modern browsers support HTML5 Local Storage, which allows secure storage of session data and user interface preferences locally on your computer.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              2. How Voyanta Uses Cookies & Storage
            </h2>
            <div className="space-y-4 mt-4">
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h3 className="font-bold text-on-surface text-lg mb-1">Strictly Necessary Session Tokens</h3>
                <p className="text-sm">
                  Used to authenticate active agency sessions, maintain secure JWT session tokens, and verify permissions across proposal wizard steps. These cannot be disabled without breaking application sign-in.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h3 className="font-bold text-on-surface text-lg mb-1">User Preference Storage</h3>
                <p className="text-sm">
                  Stores your active UI theme (Dark Mode vs Light Mode), sidebar collapse states, and local proposal draft caching so your work is never lost during network drops.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h3 className="font-bold text-on-surface text-lg mb-1">Performance & Error Diagnostics</h3>
                <p className="text-sm">
                  Collects anonymized frontend diagnostic logs to identify page load speeds and error traces. No client personally identifiable information (PII) is shared with advertising networks.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              3. Managing Your Cookie Preferences
            </h2>
            <p>
              You can review, modify, or withdraw your cookie consent at any time through our DPDP Act Consent Banner or directly through your web browser's privacy settings.
            </p>
          </section>

        </div>

        {/* Footer actions */}
        <div className="mt-16 pt-8 border-t border-outline-variant flex justify-between items-center text-sm text-on-surface-variant">
          <span>© {new Date().getFullYear()} Voyanta Technologies Pvt. Ltd.</span>
          <div className="flex gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-primary transition-colors">Terms of Service</button>
          </div>
        </div>
      </div>
    </div>
  );
}
