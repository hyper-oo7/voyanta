import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
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
            Legal & Compliance • India DPDP Act 2023
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-on-surface tracking-tight mb-4">
            Privacy Policy & Data Fiduciary Notice
          </h1>
          <p className="text-sm text-on-surface-variant">
            Last Updated: July 12, 2026 • Compliant with the Digital Personal Data Protection (DPDP) Act, 2023 & Information Technology Act, 2000
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-10 text-on-surface-variant leading-relaxed text-base">
          
          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              1. Introduction & Scope of Processing
            </h2>
            <p className="mb-4">
              Voyanta ("we", "our", or "us") operates as a specialized Business-to-Business (B2B) operating system and AI Vault platform for luxury travel advisors and travel agencies across India and globally. This Privacy Policy serves as an explicit notice under Section 5 of India's Digital Personal Data Protection Act, 2023 ("DPDP Act").
            </p>
            <p>
              In providing our services, we act as a Data Fiduciary regarding the personal data of registered travel agency owners and team members ("Authorized Users"), and as a Data Processor on behalf of travel agencies regarding the travel itineraries, passenger profiles, and supplier documentation they upload into their agency workspace ("Agency Data").
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              2. Categories of Personal Data Collected
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h3 className="font-bold text-on-surface text-lg mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  Agency & Advisor Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Full legal name, agency business name, and GSTIN (if applicable)</li>
                  <li>Business email address, phone number, and billing credentials</li>
                  <li>Agency branding preferences, logos, and custom color themes</li>
                  <li>Authentication identifiers and secure cryptographic tokens</li>
                </ul>
              </div>
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h3 className="font-bold text-on-surface text-lg mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">folder_shared</span>
                  Vault & Proposal Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Supplier rate sheets, contracts, and PDF itineraries uploaded to My Vault</li>
                  <li>Client travel preferences, destination interests, and budget tiers</li>
                  <li>Passenger names and travel requirements entered into proposal wizards</li>
                  <li>Activity logs and proposal interaction metrics</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              3. Purpose of Data Processing & AI Governance
            </h2>
            <p className="mb-4">
              We process personal and operational data strictly for lawful purposes authorized by explicit consent or contractual necessity:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong className="text-on-surface">AI Vault & Knowledge Extraction:</strong> Documents uploaded to My Vault are processed via private, isolated AI models to extract destination names, pricing tables, and itinerary schedules. <strong className="text-primary">Your agency's proprietary documents and client data are NEVER used to train shared public AI foundation models.</strong>
              </li>
              <li>
                <strong className="text-on-surface">Private Storage Architecture:</strong> Raw extracted texts and AI JSON outputs are stored in dedicated, encrypted private object storage buckets (Cloudflare R2) scoped exclusively by your Agency ID.
              </li>
              <li>
                <strong className="text-on-surface">Automated Costing & Sanity Checks:</strong> Performing deterministic pricing calculations, markup applications, and itinerary quality verifications.
              </li>
            </ul>
          </section>

          <section className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant shadow-sm">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              4. Rights of Data Principals (DPDP Act Sections 11–14)
            </h2>
            <p className="mb-4">
              Under India's Digital Personal Data Protection Act, 2023, Data Principals possess clear, enforceable rights regarding their personal data:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container">
                <h4 className="font-bold text-on-surface text-sm mb-1">Right to Information & Access</h4>
                <p className="text-xs">Obtain confirmation and a summary of personal data currently being processed by us.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container">
                <h4 className="font-bold text-on-surface text-sm mb-1">Right to Correction & Erasure</h4>
                <p className="text-xs">Request immediate rectification of inaccurate data or permanent deletion upon completion of lawful purpose.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container">
                <h4 className="font-bold text-on-surface text-sm mb-1">Right to Grievance Redressal</h4>
                <p className="text-xs">Direct recourse to our designated Data Protection Grievance Officer for rapid resolution.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container">
                <h4 className="font-bold text-on-surface text-sm mb-1">Right to Nominate</h4>
                <p className="text-xs">Nominate an individual to exercise data rights in the event of incapacity or death.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              5. Data Retention & Automatic Purging
            </h2>
            <p>
              We enforce strict data minimization and lifecycle retention schedules:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3 pl-2">
              <li>
                <strong className="text-on-surface">Activity Logs & Affinity Aggregation:</strong> Operational interaction logs are aggregated into anonymized affinity scores and automatically purged after <strong className="text-on-surface">60 days</strong>.
              </li>
              <li>
                <strong className="text-on-surface">Agency Account Data:</strong> Retained for the duration of your active subscription. Upon verified account closure, all agency records, vault documents, and database entries are permanently deleted within 30 days.
              </li>
            </ul>
          </section>

          <section className="bg-primary/5 p-8 rounded-3xl border border-primary/20">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-4">
              6. Grievance Officer & Contact Information
            </h2>
            <p className="mb-4">
              In compliance with Section 11 of the DPDP Act, 2023 and the IT (Reasonable Security Practices) Rules, 2011, you may contact our designated Grievance Officer regarding any data privacy inquiry or request:
            </p>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-outline-variant text-sm space-y-1">
              <p><strong className="text-on-surface">Grievance Officer:</strong> Raman Kumar (Data Protection & Compliance Lead)</p>
              <p><strong className="text-on-surface">Company:</strong> Voyanta Technologies Pvt. Ltd.</p>
              <p><strong className="text-on-surface">Email:</strong> <a href="mailto:privacy@voyanta.in" className="text-primary underline">privacy@voyanta.in</a></p>
              <p><strong className="text-on-surface">Address:</strong> Level 4, Cyber Park, Sector 62, Noida, NCR, India</p>
            </div>
          </section>

        </div>

        {/* Footer actions */}
        <div className="mt-16 pt-8 border-t border-outline-variant flex justify-between items-center text-sm text-on-surface-variant">
          <span>© {new Date().getFullYear()} Voyanta Technologies Pvt. Ltd.</span>
          <div className="flex gap-6">
            <button onClick={() => navigate('/terms')} className="hover:text-primary transition-colors">Terms of Service</button>
            <button onClick={() => navigate('/cookies')} className="hover:text-primary transition-colors">Cookie Policy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
