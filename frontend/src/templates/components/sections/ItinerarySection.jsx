import React from 'react';
import { renderDayLayout } from '../../dayLayouts/index.js';
import { FlightCard, ActivityCard, HotelCard } from '../cards/index.js';
import SectionDivider from '../utility/SectionDivider.jsx';
import PageBreakSmart from '../utility/PageBreakSmart.jsx';

/**
 * Daily Chronicle & Itinerary Section component.
 * Uses dayLayoutSequence to render each day with a distinct layout from the 20-layout library.
 * Automatically embeds flight, hotel, and activity cards associated with each day.
 */
export default function ItinerarySection({ proposal = {}, items = [], theme = {}, layoutConfig = {}, currency = 'INR' }) {
  const days = proposal.itinerary || proposal.days || [];
  if (!Array.isArray(days) || days.length === 0) return null;

  const sequence = layoutConfig.dayLayouts || layoutConfig.dayLayoutSequence || ['alternating-layout'];
  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  // Extract day images
  const dayImages = proposal.dayImages || proposal.day_images || [];

  return (
    <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Daily Chronicle</span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
          Day by Day Itinerary
        </h2>
        <p className="text-base" style={{ color: textSec }}>
          A curated day-by-day guide to your journey, featuring private tours, scenic transfers, and unforgettable local discoveries.
        </p>
      </div>

      <div className="space-y-16">
        {days.map((day, idx) => {
          const num = day.day || idx + 1;
          // Determine layout for this day
          const layoutId = sequence[idx % sequence.length] || 'alternating-layout';
          
          // Determine image for this day
          const imgUrl = day.image_url || day.url || day.photo || dayImages[idx] || 
            `https://images.unsplash.com/photo-${1500000000000 + (idx * 1234567)}?auto=format&fit=crop&w=800&q=80`;
          
          // Find any items (flights, activities, hotels) assigned specifically to this day
          const dayItems = (items || []).filter(it => Number(it.day || it.day_number || it.dayNum) === num);
          const flights = dayItems.filter(it => (it.kind || '').toLowerCase() === 'flight');
          const activities = dayItems.filter(it => (it.kind || '').toLowerCase() === 'activity' || (it.kind || '').toLowerCase() === 'experience');
          const hotels = dayItems.filter(it => (it.kind || '').toLowerCase() === 'hotel');

          return (
            <div key={idx} className="day-chronicle-block">
              {idx > 0 && idx % 3 === 0 && <PageBreakSmart mode="before" />}
              
              {/* Render Core Day Layout */}
              {renderDayLayout(layoutId, {
                day,
                dayImage: imgUrl,
                theme,
                index: idx,
                isEven: idx % 2 === 1,
              })}

              {/* Render Attached Day Cards if available */}
              {(flights.length > 0 || activities.length > 0 || hotels.length > 0) && (
                <div className="mt-6 pl-0 md:pl-12 space-y-4">
                  {flights.map((f, i) => (
                    <FlightCard key={`f-${i}`} item={f} theme={theme} currency={currency} />
                  ))}
                  {activities.map((a, i) => (
                    <ActivityCard key={`a-${i}`} item={a} theme={theme} currency={currency} />
                  ))}
                  {hotels.map((h, i) => (
                    <div key={`h-${i}`} className="max-w-xl">
                      <HotelCard item={h} theme={theme} variant="card-grid" currency={currency} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
