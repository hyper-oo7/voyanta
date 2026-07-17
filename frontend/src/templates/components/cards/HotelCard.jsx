import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import StatBadge from '../utility/StatBadge.jsx';
import { formatPrice as libFormatPrice } from '../../../lib/currency.js';

/**
 * Premium Hotel Card component.
 * Displays hotel image, rating, room category, check-in/out dates, pricing, and amenities.
 */
export default function HotelCard({ item, theme = {}, variant = 'default', currency = 'INR', visibilityMode = 'ITEMIZED' }) {
  if (!item) return null;

  const title = item.label || item.hotel_name || item.name || 'Luxury Accommodation';
  const desc = item.desc || item.description || item.notes || '';
  const price = Number(item.unit_price || item.price || 0) * Number(item.qty || item.nights || 1);
  const showItemPrice = price > 0 && (visibilityMode || item?.visibilityMode || item?.visibility_mode || 'ITEMIZED').toUpperCase() === 'ITEMIZED';
  const imgUrl = item.image_url || item.url || item.photo || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80';
  const rating = item.rating || item.stars || 5;
  const roomType = item.room_type || item.category || 'Deluxe Suite';
  const nights = item.qty || item.nights || 1;

  const formatPrice = (val) => libFormatPrice(val, currency);

  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textColor = theme.colors?.text || '#1a1a1a';
  const textSec = theme.colors?.textSecondary || '#64748b';

  if (variant === 'luxury-card-stack' || variant === 'editorial-list') {
    return (
      <GlassCard theme={theme} className="mb-8 overflow-hidden group">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-5/12 h-64 md:h-auto relative overflow-hidden">
            <img 
              src={imgUrl} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute top-4 left-4">
              <StatBadge label={`${nights} Night${nights > 1 ? 's' : ''}`} theme={theme} />
            </div>
            {rating && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-amber-400 text-sm font-semibold flex items-center">
                {'★'.repeat(Math.min(5, Math.floor(rating)))}
                <span className="text-white ml-1 text-xs">{rating} Star</span>
              </div>
            )}
          </div>
          <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: accentColor }}>
                {roomType}
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
                {title}
              </h3>
              {desc && <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: textSec }}>{desc}</p>}
            </div>
            <div className="pt-4 border-t flex items-center justify-between mt-auto" style={{ borderColor: theme.colors?.border }}>
              <div className="text-xs" style={{ color: textSec }}>
                Includes Breakfast & All Taxes
              </div>
              {showItemPrice && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Price</div>
                  <div className="text-xl font-bold" style={{ color: primaryColor }}>{formatPrice(price)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  // Default grid card
  return (
    <GlassCard theme={theme} className="flex flex-col h-full overflow-hidden group">
      <div className="h-52 relative overflow-hidden">
        <img src={imgUrl} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute top-3 left-3">
          <StatBadge label={`${nights} Night${nights > 1 ? 's' : ''}`} theme={theme} />
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
            {roomType}
          </div>
          <h4 className="text-lg font-bold mb-2" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            {title}
          </h4>
          {desc && <p className="text-xs leading-normal line-clamp-2 mb-4" style={{ color: textSec }}>{desc}</p>}
        </div>
        <div className="pt-3 border-t flex items-center justify-between mt-auto" style={{ borderColor: theme.colors?.border }}>
          <div className="text-xs font-medium text-amber-500">
            {'★'.repeat(Math.min(5, Math.floor(rating)))}
          </div>
          {showItemPrice && (
            <div className="text-base font-bold" style={{ color: primaryColor }}>
              {formatPrice(price)}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
