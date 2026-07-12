import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
            B2B Terms of Service • India Jurisdiction
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-on-surface tracking-tight mb-4">
            Terms of Service & Agency Subscription Agreement
          </h1>
          <p className="text-sm text-on-surface-variant">
            Last Updated: July 12, 2026 • Governed by the Laws of India
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-10 text-on-surface-variant leading-relaxed text-base">
          
          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="mb-4">
              By accessing, registering for, or utilizing the Voyanta platform ("Service"), you agree to be bound by these Terms of Service ("Terms") entered into between your agency ("Agency" or "Subscriber") and Voyanta Technologies Pvt. Ltd. ("Voyanta").
            </p>
            <p>
              If you are entering into this agreement on behalf of a travel management business, corporate entity, or partnership, you represent that you have full authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              2. Subscription Plans & Billing (Indian Rupees ₹)
            </h2>
            <p className="mb-4">
              Voyanta offers tiered subscription plans billed in Indian Rupees (INR / ₹) either monthly or annually:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong className="text-on-surface">Starter (₹999/month):</strong> Designed for solo travel agents and boutique consultants, including up to 50 active proposals/month, basic AI Vault processing, CRM, invoicing, and 16 basic templates.
              </li>
              <li>
                <strong className="text-on-surface">Professional (₹2,999/month):</strong> Includes 200 proposals/month, AI Proposal Rewrite, AI Proposal Review, and 80 premium templates.
              </li>
              <li>
                <strong className="text-on-surface">Professional Plus (₹3,999/month):</strong> Includes unlimited proposals, AI Curated Itineraries, AI Hotel & Activity Suggestions, AI Cost Optimization, and priority support.
              </li>
              <li>
                <strong className="text-on-surface">Enterprise (₹7,999/month):</strong> Includes up to 5 multi-agent sub-accounts, role-based access control, shared CRM, team analytics, and priority onboarding.
              </li>
            </ul>
            <p className="mt-4 text-sm text-on-surface">
              All applicable Goods & Services Tax (GST @ 18%) will be invoiced in accordance with Indian tax regulations against valid agency GSTIN credentials.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              3. Intellectual Property & Proprietary Rights
            </h2>
            <div className="space-y-4">
              <p>
                <strong className="text-on-surface">Agency Content Ownership:</strong> You retain 100% exclusive ownership of all travel itineraries, supplier rate sheets, client details, proposal text, and branding logos uploaded to your Voyanta account.
              </p>
              <p>
                <strong className="text-on-surface">Platform Ownership:</strong> Voyanta retains all rights, title, and interest in the underlying software architecture, design templates, AI extraction pipelines, algorithms, and interface aesthetics.
              </p>
            </div>
          </section>

          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              4. Warranties & Limitation of Liability
            </h2>
            <p className="mb-4">
              Voyanta provides intelligent software tools to assist travel agents in proposal creation, costing calculation, and supplier document management. While our AI review systems check for potential inconsistencies, the final review and verification of hotel tariffs, flight timings, visa policies, and travel contracts remain the sole responsibility of the subscribing travel agency.
            </p>
            <p>
              In no event shall Voyanta Technologies Pvt. Ltd. be liable for indirect, incidental, or punitive damages arising out of proposal errors or third-party supplier cancellations.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              5. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any legal dispute, controversy, or claim arising out of or relating to this agreement shall be subject to the exclusive jurisdiction of the courts located in New Delhi, NCR, India.
            </p>
          </section>

        </div>

        {/* Footer actions */}
        <div className="mt-16 pt-8 border-t border-outline-variant flex justify-between items-center text-sm text-on-surface-variant">
          <span>© {new Date().getFullYear()} Voyanta Technologies Pvt. Ltd.</span>
          <div className="flex gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => navigate('/cookies')} className="hover:text-primary transition-colors">Cookie Policy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
