import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import SectionDivider from '../utility/SectionDivider.jsx';

/**
 * Terms & Conditions section component.
 * Displays booking policies, cancellation rules, payment schedules, and agency disclosures.
 * Supports 3 variants: minimal-footer, full-page, two-column
 */
export default function TermsSection({ proposal = {}, theme = {}, variant = 'minimal-footer' }) {
  const rawTerms = proposal.terms ?? proposal.preferences?.branding?.terms_conditions;
  const terms = Array.isArray(rawTerms) ? rawTerms : (typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms.split('\n').filter(Boolean) : []);

  if (terms.length === 0) return null;

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  // ─── 1. Full Page Variant ──────────────────────────────────────────────
  if (variant === 'full-page') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-5xl mx-auto">
        <GlassCard theme={theme} className="p-8 md:p-14 border">
          <div className="mb-8 pb-4 border-b" style={{ borderColor: theme.colors?.border }}>
            <span className="text-xs uppercase tracking-widest font-semibold block mb-1" style={{ color: accentColor }}>Legal & Operational</span>
            <h2 className="text-3xl font-serif font-bold" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
              Terms, Conditions & Booking Policies
            </h2>
          </div>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: textSec }}>
            {terms.map((t, idx) => (
              <div key={idx} className="flex items-start">
                <span className="font-mono font-bold mr-4 select-none" style={{ color: accentColor }}>§ {idx + 1}.</span>
                <p>{t}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t text-xs text-gray-500 italic">
            By accepting this proposal and submitting the booking deposit, the client acknowledges and agrees to the terms and cancellation policies stated herein.
          </div>
        </GlassCard>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 2. Default: Minimal Footer Variant ────────────────────────────────
  return (
    <section className="py-12 px-8 md:px-16 max-w-6xl mx-auto text-xs text-gray-500 border-t" style={{ borderColor: theme.colors?.border }}>
      <h4 className="font-bold uppercase tracking-wider text-gray-700 mb-3">Booking Terms & Cancellation Policies</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terms.map((t, idx) => (
          <div key={idx} className="flex items-start">
            <span className="mr-2 opacity-60">•</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
