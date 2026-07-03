import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';

/**
 * Destination Overview Card component.
 * Displays destination name, cover photo, climate, best time to visit, and highlights.
 */
export default function DestinationCard({ destination, image, description, theme = {} }) {
  if (!destination && !description) return null;

  const title = destination || 'Featured Destination';
  const imgUrl = image || 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1000&q=80';
  const desc = description || 'Experience the vibrant culture, breathtaking landscapes, and luxury hospitality of this remarkable region.';

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';

  return (
    <GlassCard theme={theme} className="overflow-hidden mb-8 relative">
      <div className="h-64 relative overflow-hidden">
        <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-6 md:p-8">
          <div>
            <span className="text-white/80 text-xs uppercase tracking-widest font-semibold">Destination Focus</span>
            <h3 className="text-3xl md:text-4xl font-serif text-white font-bold" style={{ fontFamily: theme.typography?.headline }}>
              {title}
            </h3>
          </div>
        </div>
      </div>
      <div className="p-6 md:p-8">
        <p className="text-base leading-relaxed mb-6" style={{ color: textSec }}>
          {desc}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: theme.colors?.border }}>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: accentColor }}>Climate</div>
            <div className="text-sm font-semibold" style={{ color: primaryColor }}>Pleasant & Sunny</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: accentColor }}>Best Time</div>
            <div className="text-sm font-semibold" style={{ color: primaryColor }}>Year Round</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: accentColor }}>Vibe</div>
            <div className="text-sm font-semibold" style={{ color: primaryColor }}>Luxury & Culture</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: accentColor }}>Hospitality</div>
            <div className="text-sm font-semibold" style={{ color: primaryColor }}>World Class</div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
