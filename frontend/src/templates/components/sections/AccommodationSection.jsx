import React from 'react';
import { HotelCard } from '../cards/index.js';
import SectionDivider from '../utility/SectionDivider.jsx';

/**
 * Accommodation Section component.
 * Displays hotels and resorts included in the proposal.
 * Supports 5 variants: card-grid, luxury-card-stack, editorial-list, masonry, single-focus
 */
export default function AccommodationSection({ items = [], theme = {}, variant = 'card-grid', currency = 'INR', proposal = {} }) {
  const hotels = items.filter(it => (it.kind || '').toLowerCase() === 'hotel');
  if (!hotels || hotels.length === 0) return null;

  const visibilityMode = (proposal?.visibility_mode || 'ITEMIZED').toUpperCase();

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  // ─── 1. Luxury Card Stack & Editorial List Variants ────────────────────
  if (variant === 'luxury-card-stack' || variant === 'editorial-list') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Your Sanctuaries</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Premier Accommodations
          </h2>
          <p className="text-base" style={{ color: textSec }}>
            Hand-selected luxury hotels and resorts chosen for their exceptional comfort, prime locations, and world-class hospitality.
          </p>
        </div>

        <div className="space-y-8">
          {hotels.map((hotel, idx) => (
            <HotelCard key={hotel.id || idx} item={hotel} theme={theme} variant={variant} currency={currency} visibilityMode={visibilityMode} />
          ))}
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 2. Single Focus Variant ───────────────────────────────────────────
  if (variant === 'single-focus') {
    const featured = hotels[0];
    const others = hotels.slice(1);
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Where You Will Stay</span>
          <h2 className="text-3xl md:text-4xl font-bold font-serif" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Featured Accommodations
          </h2>
        </div>

        {featured && (
          <div className="mb-12">
            <HotelCard item={featured} theme={theme} variant="luxury-card-stack" currency={currency} visibilityMode={visibilityMode} />
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h3 className="text-xl font-bold mb-6" style={{ color: primaryColor }}>Other Accommodations Along Your Route</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {others.map((hotel, idx) => (
                <HotelCard key={hotel.id || idx} item={hotel} theme={theme} variant="card-grid" currency={currency} visibilityMode={visibilityMode} />
              ))}
            </div>
          </div>
        )}
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 3. Default: Card Grid / Masonry Variant ───────────────────────────
  return (
    <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Hospitality & Comfort</span>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
          Selected Accommodations
        </h2>
        <p className="text-base" style={{ color: textSec }}>
          Rest and rejuvenate in handpicked accommodations offering impeccable service and supreme comfort.
        </p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${hotels.length > 2 ? 'lg:grid-cols-3' : ''} gap-8`}>
        {hotels.map((hotel, idx) => (
          <HotelCard key={hotel.id || idx} item={hotel} theme={theme} variant="card-grid" currency={currency} visibilityMode={visibilityMode} />
        ))}
      </div>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
