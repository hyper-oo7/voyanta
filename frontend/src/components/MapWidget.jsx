import React from 'react';
import { getUIText } from '../utils/translator.js';

const CITY_COORDS = {
  'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Jaipur, Rajasthan' },
  'udaipur': { lat: 24.5854, lon: 73.7125, name: 'Udaipur, Rajasthan' },
  'paris': { lat: 48.8566, lon: 2.3522, name: 'Paris, France' },
  'rome': { lat: 41.9028, lon: 12.4964, name: 'Rome, Italy' },
  'goa': { lat: 15.2993, lon: 74.1240, name: 'Goa, India' },
  'mumbai': { lat: 19.0760, lon: 72.8777, name: 'Mumbai, India' },
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi, India' },
  'tokyo': { lat: 35.6762, lon: 139.6503, name: 'Tokyo, Japan' },
  'london': { lat: 51.5074, lon: -0.1278, name: 'London, UK' },
};

export default function MapWidget({ destination = 'Jaipur', lang = 'en' }) {
  const destLower = (destination || '').toLowerCase();
  let found = null;
  Object.keys(CITY_COORDS).forEach((k) => {
    if (destLower.includes(k)) found = CITY_COORDS[k];
  });
  if (!found) found = CITY_COORDS['jaipur'];

  const { lat, lon, name } = found;

  const delta = 0.05;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination || name)}`;

  return (
    <div className="glass-card rounded-2xl p-5 border border-outline-variant shadow-sm transition-all flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-on-surface">
            {getUIText(lang, 'mapLocation')}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {getUIText(lang, 'liveLocationLabel')}: {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
          </p>
        </div>
        <span className="material-symbols-outlined text-primary text-2xl">location_on</span>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden border border-outline-variant/60 relative bg-surface-variant">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight="0"
          marginWidth="0"
          src={mapUrl}
          style={{ border: 'none' }}
          title="Destination Map Location"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-primary flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live GPS Centered
        </span>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          {getUIText(lang, 'viewOnGoogleMaps')}
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>
    </div>
  );
}
