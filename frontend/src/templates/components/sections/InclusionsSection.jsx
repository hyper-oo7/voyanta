import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import SectionDivider from '../utility/SectionDivider.jsx';

/**
 * Inclusions & Exclusions section component.
 * Displays what is included and excluded in the proposal price.
 * Supports 4 variants: two-column-checklist, icon-list, card-pair, compact-list
 */
export default function InclusionsSection({ proposal = {}, theme = {}, variant = 'two-column-checklist' }) {
  const rawInc = proposal.inclusions ?? proposal.included_items;
  const inclusions = Array.isArray(rawInc) ? rawInc : (typeof rawInc === 'string' && rawInc.trim() ? rawInc.split('\n').filter(Boolean) : []);

  const rawExc = proposal.exclusions ?? proposal.excluded_items;
  const exclusions = Array.isArray(rawExc) ? rawExc : (typeof rawExc === 'string' && rawExc.trim() ? rawExc.split('\n').filter(Boolean) : []);

  if (inclusions.length === 0 && exclusions.length === 0) return null;

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  // ─── 1. Card Pair Variant ──────────────────────────────────────────────
  if (variant === 'card-pair') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Clarity & Transparency</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Inclusions & Exclusions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlassCard theme={theme} className="p-8 md:p-10 border-t-4 border-green-600">
            <h3 className="text-2xl font-serif font-bold mb-6 flex items-center text-green-700">
              <span className="material-symbols-outlined mr-3 text-3xl">check_circle</span>
              What is Included
            </h3>
            <ul className="space-y-4">
              {inclusions.map((item, idx) => (
                <li key={idx} className="flex items-start text-sm md:text-base">
                  <span className="text-green-600 font-bold mr-3 mt-0.5">✓</span>
                  <span style={{ color: textSec }}>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard theme={theme} className="p-8 md:p-10 border-t-4 border-rose-600">
            <h3 className="text-2xl font-serif font-bold mb-6 flex items-center text-rose-700">
              <span className="material-symbols-outlined mr-3 text-3xl">cancel</span>
              Not Included
            </h3>
            <ul className="space-y-4">
              {exclusions.map((item, idx) => (
                <li key={idx} className="flex items-start text-sm md:text-base">
                  <span className="text-rose-600 font-bold mr-3 mt-0.5">✕</span>
                  <span style={{ color: textSec }}>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 2. Default: Two Column Checklist Variant ──────────────────────────
  return (
    <section className="py-16 px-8 md:px-16 max-w-6xl mx-auto">
      <div className="mb-12 text-center">
        <h2 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
          Inclusions & Exclusions
        </h2>
        <div className="w-16 h-0.5 mx-auto mt-4" style={{ backgroundColor: accentColor }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider mb-6 pb-2 border-b flex items-center text-green-700" style={{ borderColor: theme.colors?.border }}>
            <span className="material-symbols-outlined mr-2">add_circle</span>
            Included in Quotation
          </h3>
          <ul className="space-y-3">
            {inclusions.map((item, idx) => (
              <li key={idx} className="flex items-start text-sm">
                <span className="material-symbols-outlined text-green-600 text-base mr-2 mt-0.5">check</span>
                <span style={{ color: textSec }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold uppercase tracking-wider mb-6 pb-2 border-b flex items-center text-gray-500" style={{ borderColor: theme.colors?.border }}>
            <span className="material-symbols-outlined mr-2">remove_circle</span>
            Not Included / Additional
          </h3>
          <ul className="space-y-3">
            {exclusions.map((item, idx) => (
              <li key={idx} className="flex items-start text-sm">
                <span className="material-symbols-outlined text-gray-400 text-base mr-2 mt-0.5">close</span>
                <span style={{ color: textSec }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
