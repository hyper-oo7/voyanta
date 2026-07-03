import React from 'react';
import StatBadge from '../utility/StatBadge.jsx';

/**
 * Universal Hero Banner section component.
 * Supports 5 variants: full-bleed-cinematic, split-screen, minimal-text, collage-hero, editorial-cover
 */
export default function HeroBanner({ proposal = {}, theme = {}, variant = 'full-bleed-cinematic', items = [] }) {
  const name = proposal.name || proposal.title || 'Exclusive Travel Proposal';
  const clientName = proposal.client_name || proposal.client || proposal.preferences?.branding?.client_name || '';
  const dest = proposal.destination || 'Selected Destinations';
  const days = proposal.duration_days || proposal.days || 7;
  const nights = days > 1 ? days - 1 : 1;

  // Find a good hero image from proposal or theme defaults
  const customHero = proposal.preferences?.branding?.hero_image || proposal.hero_image || proposal.cover_image;
  const imgUrl = customHero || 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=80';

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textColor = theme.colors?.text || '#1a1a1a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const overlay = theme.colors?.heroOverlay || 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%)';
  const minH = theme.decorations?.heroMinHeight || '850px';

  // ─── 1. Split Screen Variant ───────────────────────────────────────────
  if (variant === 'split-screen') {
    return (
      <section className="min-h-[800px] flex flex-col md:flex-row w-full bg-white relative overflow-hidden" style={{ minHeight: minH }}>
        <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center relative z-10" style={{ backgroundColor: theme.colors?.background }}>
          <div className="mb-6 flex flex-wrap gap-2">
            <StatBadge label={dest} icon="location_on" theme={theme} />
            <StatBadge label={`${days} Days / ${nights} Nights`} icon="calendar_month" theme={theme} variant="square" />
          </div>
          <h1 
            className="text-4xl md:text-6xl font-bold font-serif mb-6 leading-tight" 
            style={{ color: primaryColor, fontFamily: theme.typography?.headline }}
          >
            {name}
          </h1>
          {clientName && (
            <div className="mb-8 pt-6 border-t" style={{ borderColor: theme.colors?.border }}>
              <span className="text-xs uppercase tracking-widest block mb-1" style={{ color: textSec }}>Prepared For</span>
              <span className="text-2xl font-serif font-semibold" style={{ color: accentColor }}>{clientName}</span>
            </div>
          )}
          <p className="text-base leading-relaxed max-w-lg" style={{ color: textSec }}>
            A bespoke travel itinerary crafted with meticulous attention to detail, luxury accommodations, and private curated experiences.
          </p>
        </div>
        <div className="md:w-1/2 h-96 md:h-auto relative overflow-hidden">
          <img src={imgUrl} alt={dest} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      </section>
    );
  }

  // ─── 2. Minimal Text Variant ───────────────────────────────────────────
  if (variant === 'minimal-text') {
    return (
      <section className="py-20 md:py-32 px-8 md:px-16 text-center w-full relative" style={{ backgroundColor: theme.colors?.background }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6" style={{ backgroundColor: theme.colors?.surfaceAlt, color: accentColor }}>
            {dest} • {days} Days
          </div>
          <h1 
            className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight" 
            style={{ color: primaryColor, fontFamily: theme.typography?.headline }}
          >
            {name}
          </h1>
          {clientName && (
            <p className="text-xl md:text-2xl font-light mb-10" style={{ color: textSec }}>
              Exclusively curated for <span className="font-semibold" style={{ color: accentColor }}>{clientName}</span>
            </p>
          )}
          <div className="w-24 h-0.5 mx-auto my-8" style={{ backgroundColor: accentColor }} />
        </div>
      </section>
    );
  }

  // ─── 3. Editorial Cover Variant ────────────────────────────────────────
  if (variant === 'editorial-cover') {
    return (
      <section className="min-h-[900px] w-full relative flex flex-col justify-between p-10 md:p-16 overflow-hidden text-white" style={{ minHeight: minH }}>
        <img src={imgUrl} alt={dest} className="absolute inset-0 w-full h-full object-cover z-0" />
        <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.9) 100%)' }} />
        
        <div className="relative z-20 flex justify-between items-center border-b border-white/20 pb-6">
          <span className="text-sm tracking-widest uppercase font-mono">{dest}</span>
          <span className="text-sm tracking-widest uppercase font-mono">{days} Days / {nights} Nights</span>
        </div>

        <div className="relative z-20 my-auto py-12 text-center max-w-5xl mx-auto">
          <span className="text-xs md:text-sm uppercase tracking-[0.3em] block mb-4 text-white/80 font-accent">The Curated Journey</span>
          <h1 
            className="text-6xl md:text-8xl font-serif font-bold tracking-tight mb-6 leading-none drop-shadow-lg"
            style={{ fontFamily: theme.typography?.headline }}
          >
            {name}
          </h1>
          <div className="w-16 h-px bg-white/60 mx-auto my-6" />
        </div>

        <div className="relative z-20 flex flex-col md:flex-row justify-between items-end border-t border-white/20 pt-6">
          <div>
            <span className="text-xs uppercase tracking-widest block text-white/70 mb-1">Prepared Exclusively For</span>
            <span className="text-xl md:text-2xl font-serif font-medium">{clientName || 'Valued Client'}</span>
          </div>
          <div className="text-right mt-4 md:mt-0 text-xs text-white/70 tracking-wider">
            VOYANTA LUXURY PORTFOLIO • {new Date().getFullYear()}
          </div>
        </div>
      </section>
    );
  }

  // ─── 4. Collage Hero Variant ───────────────────────────────────────────
  if (variant === 'collage-hero') {
    return (
      <section className="min-h-[850px] w-full relative flex items-center justify-center p-8 md:p-16 overflow-hidden" style={{ backgroundColor: theme.colors?.background, minHeight: minH }}>
        <div className="absolute inset-0 opacity-20 z-0">
          <img src={imgUrl} alt="backdrop" className="w-full h-full object-cover blur-sm" />
        </div>
        
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10 items-center">
          <div className="md:col-span-7">
            <div className="mb-4 flex gap-2">
              <StatBadge label={dest} theme={theme} />
              <StatBadge label={`${days} Days`} theme={theme} variant="square" />
            </div>
            <h1 
              className="text-5xl md:text-7xl font-serif font-bold mb-6 leading-tight"
              style={{ color: primaryColor, fontFamily: theme.typography?.headline }}
            >
              {name}
            </h1>
            {clientName && (
              <p className="text-xl mb-8" style={{ color: textSec }}>
                Prepared for <strong style={{ color: accentColor }}>{clientName}</strong>
              </p>
            )}
            <p className="text-base leading-relaxed max-w-lg" style={{ color: textSec }}>
              Immerse yourself in a journey designed around your personal tastes, featuring VIP transfers, premier accommodations, and extraordinary local encounters.
            </p>
          </div>
          
          <div className="md:col-span-5 relative">
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform rotate-2">
              <img src={imgUrl} alt={dest} className="w-full h-80 object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 w-3/4 h-64 rounded-2xl overflow-hidden shadow-xl border-4 border-white transform -rotate-3 z-20">
              <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" alt="collage 2" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── 5. Default: Full Bleed Cinematic Variant ──────────────────────────
  return (
    <section className="min-h-[850px] w-full relative flex flex-col justify-end p-8 md:p-20 overflow-hidden text-white" style={{ minHeight: minH }}>
      <img src={imgUrl} alt={dest} className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 z-10" style={{ background: overlay }} />

      <div className="relative z-20 max-w-5xl">
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-white/20 backdrop-blur-md text-white border border-white/30">
            {dest}
          </span>
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-black/40 backdrop-blur-md text-white border border-white/20">
            {days} Days / {nights} Nights
          </span>
        </div>

        <h1 
          className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-6 leading-none drop-shadow-md"
          style={{ fontFamily: theme.typography?.headline }}
        >
          {name}
        </h1>

        {clientName && (
          <div className="pt-6 border-t border-white/30 flex flex-col md:flex-row md:items-center justify-between max-w-2xl">
            <div>
              <span className="text-xs uppercase tracking-widest text-white/70 block mb-1">Prepared Exclusively For</span>
              <span className="text-2xl font-serif font-medium text-amber-300">{clientName}</span>
            </div>
            <div className="mt-4 md:mt-0 text-sm text-white/80 font-light">
              Bespoke Luxury Itinerary
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
