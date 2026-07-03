import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import StatBadge from '../utility/StatBadge.jsx';

/**
 * Activity & Experience Card component.
 * Displays experience title, timing, description, image, and inclusion status.
 */
export default function ActivityCard({ item, theme = {}, currency = 'INR', variant = 'default' }) {
  if (!item) return null;

  const title = item.label || item.activity_name || item.name || 'Special Excursion';
  const desc = item.desc || item.description || item.notes || '';
  const imgUrl = item.image_url || item.url || item.photo || 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80';
  const time = item.timing || item.time || item.duration || 'Half Day';
  const price = Number(item.unit_price || item.price || 0) * Number(item.qty || 1);

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';

  const formatPrice = (val) => {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
    } catch {
      return `₹${val.toLocaleString()}`;
    }
  };

  return (
    <GlassCard theme={theme} className="flex flex-col md:flex-row overflow-hidden mb-6 group">
      <div className="md:w-1/3 h-48 md:h-auto relative overflow-hidden">
        <img src={imgUrl} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute top-3 left-3">
          <StatBadge label={time} icon="schedule" theme={theme} />
        </div>
      </div>
      <div className="md:w-2/3 p-6 flex flex-col justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: accentColor }}>
            Curated Experience
          </div>
          <h4 className="text-xl font-bold mb-2" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            {title}
          </h4>
          {desc && <p className="text-sm leading-relaxed line-clamp-3 mb-4" style={{ color: textSec }}>{desc}</p>}
        </div>
        <div className="pt-3 border-t flex items-center justify-between mt-auto" style={{ borderColor: theme.colors?.border }}>
          <div className="flex items-center text-xs text-green-600 font-medium">
            <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
            Included in Itinerary
          </div>
          {price > 0 && (
            <div className="font-bold text-sm" style={{ color: primaryColor }}>
              {formatPrice(price)}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
