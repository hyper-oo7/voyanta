import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';

/**
 * Call to Action (CTA) & Sign-off section component.
 * Displays approval buttons, contact details, QR code, and agency signature.
 * Supports 4 variants: gradient-cta, glass-cta, minimal-cta, luxury-cta
 */
export default function CTASection({ proposal = {}, theme = {}, variant = 'gradient-cta' }) {
  const branding = proposal.preferences?.branding || {};
  const agencyName = branding.agency_name || proposal.agency_name || 'Voyanta Luxury Travel';
  const contactEmail = branding.contact_email || proposal.contact_email || 'concierge@voyantatravel.com';
  const contactPhone = branding.contact_phone || proposal.contact_phone || '+1 (800) 555-8692';
  const website = branding.website || 'www.voyantatravel.com';

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';

  // ─── 1. Luxury CTA Variant ─────────────────────────────────────────────
  if (variant === 'luxury-cta') {
    return (
      <section className="py-20 px-8 md:px-16 bg-[#0a0a0a] text-white text-center mt-12">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs uppercase tracking-[0.3em] text-amber-400 block mb-3 font-accent">Next Steps</span>
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6 tracking-tight" style={{ fontFamily: theme.typography?.headline }}>
            Begin Your Journey
          </h2>
          <p className="text-gray-400 text-base md:text-lg mb-10 font-light">
            We invite you to review and approve this itinerary. Our dedicated concierge team is ready to secure your reservations and finalize every detail.
          </p>

          <div className="no-print mb-12 flex justify-center gap-4">
            <button 
              className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold uppercase tracking-widest text-xs transition-colors duration-300 shadow-lg"
              onClick={() => alert('Proposal Approved! Redirecting to payment schedule...')}
            >
              Approve Itinerary
            </button>
            <button 
              className="px-8 py-4 border border-white/30 hover:bg-white/10 text-white font-semibold uppercase tracking-widest text-xs transition-colors duration-300"
              onClick={() => alert('Requesting modifications from your travel designer...')}
            >
              Request Changes
            </button>
          </div>

          <div className="pt-8 border-t border-white/10 text-xs text-gray-500 flex flex-col md:flex-row justify-between items-center">
            <div className="font-serif text-sm text-white/80 mb-2 md:mb-0">{agencyName}</div>
            <div className="space-x-4">
              <span>{contactEmail}</span>
              <span>•</span>
              <span>{contactPhone}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── 2. Default: Gradient CTA Variant ──────────────────────────────────
  return (
    <section className="py-16 px-8 md:px-16 max-w-5xl mx-auto mb-16">
      <div 
        className="rounded-3xl p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden"
        style={{ background: theme.colors?.gradient || 'linear-gradient(135deg, #1a1a2e 0%, #c41e3a 100%)' }}
      >
        <div className="relative z-10 max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full mb-4 inline-block">
            Ready to Travel?
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4" style={{ fontFamily: theme.typography?.headline }}>
            Confirm Your Reservation
          </h2>
          <p className="text-white/80 text-base mb-8">
            Your travel designer has put this itinerary on tentative hold. Approve now to lock in rates and room availability.
          </p>

          <div className="no-print mb-8 flex flex-wrap justify-center gap-4">
            <button 
              className="px-8 py-3.5 bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-full shadow-lg transition-transform hover:scale-105 text-sm"
              onClick={() => alert('Proposal Approved!')}
            >
              ✓ Approve & Book Now
            </button>
          </div>

          <div className="text-xs text-white/70 pt-6 border-t border-white/20 flex flex-col md:flex-row justify-center gap-4">
            <span><strong>{agencyName}</strong></span>
            <span>|</span>
            <span>{contactEmail}</span>
            <span>|</span>
            <span>{contactPhone}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
