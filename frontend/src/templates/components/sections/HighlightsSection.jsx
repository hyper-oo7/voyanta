import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import SectionDivider from '../utility/SectionDivider.jsx';

/**
 * Highlights & Overview section component.
 * Displays trip summary, key highlights, and destination snapshot.
 * Supports 5 variants: editorial-two-column, icon-grid, magazine-spread, glass-cards, numbered-list
 */
export default function HighlightsSection({ proposal = {}, theme = {}, variant = 'editorial-two-column' }) {
  const dest = proposal.destination || 'Selected Destinations';
  const overview = proposal.overview || proposal.description || proposal.notes || 
    `Experience the very best of ${dest}. This itinerary has been thoughtfully curated to blend iconic landmarks with authentic local encounters, ensuring a seamless and memorable journey from start to finish.`;
  
  const highlights = proposal.highlights || proposal.key_highlights || [
    'Private VIP airport meet and greet with luxury chauffeured transfers',
    'Hand-selected 5-star accommodations offering panoramic views and premier service',
    'Exclusive private guided tours of historic and cultural landmarks',
    'Curated dining recommendations featuring Michelin-starred and authentic local cuisine',
    'Dedicated 24/7 concierge support throughout your entire journey'
  ];

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  // ─── 1. Icon Grid Variant ──────────────────────────────────────────────
  if (variant === 'icon-grid') {
    const icons = ['star', 'verified_user', 'diamond', 'restaurant', 'support_agent'];
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Trip Overview</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Why This Journey is Exceptional
          </h2>
          <p className="text-base leading-relaxed" style={{ color: textSec }}>{overview}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((item, idx) => (
            <GlassCard key={idx} theme={theme} className="p-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-opacity-10" style={{ backgroundColor: accentColor }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: accentColor }}>
                  {icons[idx % icons.length]}
                </span>
              </div>
              <h4 className="font-bold text-lg mb-2" style={{ color: primaryColor }}>Highlight 0{idx + 1}</h4>
              <p className="text-sm leading-relaxed" style={{ color: textSec }}>{item}</p>
            </GlassCard>
          ))}
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 2. Magazine Spread Variant ────────────────────────────────────────
  if (variant === 'magazine-spread') {
    return (
      <section className="py-20 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5">
            <span className="text-xs uppercase tracking-widest font-semibold block mb-3" style={{ color: accentColor }}>The Experience</span>
            <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6 leading-tight" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
              A Journey Like No Other
            </h2>
            <div className="w-16 h-1 mb-8" style={{ backgroundColor: accentColor }} />
            <p className="text-lg font-serif italic leading-relaxed mb-6" style={{ color: primaryColor }}>
              "{overview}"
            </p>
          </div>

          <div className="md:col-span-7 bg-opacity-5 p-8 md:p-12 rounded-2xl border" style={{ backgroundColor: theme.colors?.surfaceAlt, borderColor: theme.colors?.border }}>
            <h3 className="text-xl font-bold uppercase tracking-wider mb-6 pb-4 border-b" style={{ color: primaryColor, borderColor: theme.colors?.border }}>
              Key Inclusions & Highlights
            </h3>
            <ul className="space-y-4">
              {highlights.map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-lg mr-4 font-serif font-bold" style={{ color: accentColor }}>0{idx + 1}.</span>
                  <span className="text-base leading-relaxed" style={{ color: textSec }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 3. Numbered List Variant ──────────────────────────────────────────
  if (variant === 'numbered-list') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
          Executive Summary & Highlights
        </h2>
        <p className="text-base leading-relaxed mb-12" style={{ color: textSec }}>{overview}</p>

        <div className="space-y-6">
          {highlights.map((item, idx) => (
            <div key={idx} className="flex items-start pb-6 border-b" style={{ borderColor: theme.colors?.border }}>
              <div className="text-3xl font-mono font-bold mr-6 w-12 text-right" style={{ color: accentColor }}>
                {(idx + 1).toString().padStart(2, '0')}
              </div>
              <div className="flex-1 pt-1">
                <p className="text-base font-medium" style={{ color: primaryColor }}>{item}</p>
              </div>
            </div>
          ))}
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 4. Glass Cards Variant ────────────────────────────────────────────
  if (variant === 'glass-cards') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Curated Highlights</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Trip Snapshot
          </h2>
          <p className="text-base" style={{ color: textSec }}>{overview}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {highlights.map((item, idx) => (
            <GlassCard key={idx} theme={theme} className="p-6 flex items-start">
              <span className="material-symbols-outlined mr-4 text-2xl p-2 rounded-lg bg-opacity-10" style={{ color: accentColor, backgroundColor: accentColor }}>
                verified
              </span>
              <div>
                <h4 className="font-bold text-base mb-1" style={{ color: primaryColor }}>Highlight {idx + 1}</h4>
                <p className="text-sm leading-relaxed" style={{ color: textSec }}>{item}</p>
              </div>
            </GlassCard>
          ))}
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 5. Default: Editorial Two Column Variant ──────────────────────────
  return (
    <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Overview</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            The Essence of Your Journey
          </h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: textSec }}>{overview}</p>
        </div>

        <div className="md:col-span-7">
          <GlassCard theme={theme} className="p-8 md:p-10">
            <h3 className="text-xl font-bold font-serif mb-6 pb-4 border-b flex items-center" style={{ color: primaryColor, borderColor: theme.colors?.border }}>
              <span className="material-symbols-outlined mr-2" style={{ color: accentColor }}>auto_awesome</span>
              Curated Highlights
            </h3>
            <div className="space-y-4">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-start">
                  <span className="material-symbols-outlined mr-3 text-lg mt-0.5 flex-shrink-0" style={{ color: accentColor }}>
                    arrow_right_alt
                  </span>
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: textSec }}>{item}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
