import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import StatBadge from '../utility/StatBadge.jsx';

/**
 * Flight Card component.
 * Displays airline, flight number, departure/arrival times, routing, and cabin class.
 */
export default function FlightCard({ item, theme = {}, currency = 'INR' }) {
  if (!item) return null;

  const airline = item.airline || item.label || item.name || 'Flight Service';
  const flightNo = item.flight_number || item.code || '';
  const from = item.from || item.origin || 'Origin';
  const to = item.to || item.destination || 'Destination';
  const depTime = item.departure_time || item.dep || '09:00';
  const arrTime = item.arrival_time || item.arr || '12:30';
  const cabin = item.cabin_class || item.class || 'Economy';
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
    <GlassCard theme={theme} className="p-5 mb-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b" style={{ borderColor: theme.colors?.border }}>
        <div className="flex items-center mb-2 md:mb-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-opacity-10" style={{ backgroundColor: accentColor }}>
            <span className="material-symbols-outlined" style={{ color: accentColor }}>flight_takeoff</span>
          </div>
          <div>
            <h4 className="font-bold text-base" style={{ color: primaryColor }}>{airline}</h4>
            <div className="text-xs font-mono uppercase" style={{ color: textSec }}>{flightNo || 'Non-stop Flight'}</div>
          </div>
        </div>
        <StatBadge label={cabin} theme={theme} />
      </div>

      <div className="py-5 flex items-center justify-between">
        <div className="text-center md:text-left">
          <div className="text-2xl font-bold font-mono" style={{ color: primaryColor }}>{depTime}</div>
          <div className="text-sm font-semibold uppercase">{from}</div>
        </div>

        <div className="flex-1 px-4 flex flex-col items-center">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: textSec }}>Direct / Transit</div>
          <div className="w-full flex items-center">
            <div className="h-2 w-2 rounded-full border-2" style={{ borderColor: accentColor }} />
            <div className="flex-1 h-px border-t border-dashed" style={{ borderColor: textSec }} />
            <span className="material-symbols-outlined mx-2 text-sm" style={{ color: accentColor }}>flight</span>
            <div className="flex-1 h-px border-t border-dashed" style={{ borderColor: textSec }} />
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>
        </div>

        <div className="text-center md:text-right">
          <div className="text-2xl font-bold font-mono" style={{ color: primaryColor }}>{arrTime}</div>
          <div className="text-sm font-semibold uppercase">{to}</div>
        </div>
      </div>

      {price > 0 && (
        <div className="pt-3 border-t flex justify-end items-center" style={{ borderColor: theme.colors?.border }}>
          <span className="text-xs mr-2" style={{ color: textSec }}>Price per Passenger:</span>
          <span className="font-bold text-base" style={{ color: primaryColor }}>{formatPrice(price)}</span>
        </div>
      )}
    </GlassCard>
  );
}
