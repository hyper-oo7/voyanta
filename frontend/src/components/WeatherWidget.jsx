import React, { useEffect, useState } from 'react';
import { getUIText } from '../utils/translator.js';

const CITY_COORDS = {
  'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Jaipur' },
  'udaipur': { lat: 24.5854, lon: 73.7125, name: 'Udaipur' },
  'paris': { lat: 48.8566, lon: 2.3522, name: 'Paris' },
  'rome': { lat: 41.9028, lon: 12.4964, name: 'Rome' },
  'goa': { lat: 15.2993, lon: 74.1240, name: 'Goa' },
  'mumbai': { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'Delhi' },
  'tokyo': { lat: 35.6762, lon: 139.6503, name: 'Tokyo' },
  'london': { lat: 51.5074, lon: -0.1278, name: 'London' },
};

function getWeatherInfo(code) {
  if (code === 0) return { label: 'Sunny / Clear', icon: 'wb_sunny', color: 'text-amber-500' };
  if (code <= 3) return { label: 'Partly Cloudy', icon: 'partly_cloudy_day', color: 'text-blue-400' };
  if (code <= 69) return { label: 'Rain Showers', icon: 'rainy', color: 'text-sky-500' };
  return { label: 'Pleasant Breeze', icon: 'air', color: 'text-emerald-500' };
}

export default function WeatherWidget({ destination = 'Jaipur', lang = 'en' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const destLower = (destination || '').toLowerCase();
    let found = null;
    Object.keys(CITY_COORDS).forEach((k) => {
      if (destLower.includes(k)) found = CITY_COORDS[k];
    });
    if (!found) found = CITY_COORDS['jaipur'];

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${found.lat}&longitude=${found.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data && data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            humidity: data.current.relative_humidity_2m || 45,
            wind: Math.round(data.current.wind_speed_10m || 12),
            code: data.current.weather_code || 1,
            daily: (data.daily?.temperature_2m_max || []).slice(1, 5).map((max, idx) => ({
              day: `Day +${idx + 1}`,
              max: Math.round(max),
              min: Math.round((data.daily.temperature_2m_min || [])[idx + 1] || max - 6),
              code: (data.daily.weather_code || [])[idx + 1] || 1,
            })),
          });
        }
      })
      .catch(() => {
        // Fallback simulation for offline or API errors
        if (mounted) {
          setWeather({
            temp: 27,
            humidity: 48,
            wind: 14,
            code: 1,
            daily: [
              { day: 'Day +1', max: 28, min: 20, code: 0 },
              { day: 'Day +2', max: 29, min: 21, code: 1 },
              { day: 'Day +3', max: 27, min: 19, code: 2 },
              { day: 'Day +4', max: 28, min: 20, code: 0 },
            ],
          });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [destination]);

  const currentInfo = getWeatherInfo(weather?.code || 1);

  return (
    <div className="glass-card rounded-2xl p-5 border border-outline-variant shadow-sm transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-on-surface">
            {getUIText(lang, 'weatherForecast')}
          </h3>
          <p className="text-xs text-on-surface-variant capitalize">{destination}</p>
        </div>
        <span className="material-symbols-outlined text-primary text-2xl">thermostat</span>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center text-on-surface-variant text-sm">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Loading weather...
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between py-2 border-b border-outline-variant/60">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-4xl ${currentInfo.color}`}>
                {currentInfo.icon}
              </span>
              <div>
                <div className="text-3xl font-display font-bold text-on-surface">
                  {weather?.temp}°C
                </div>
                <div className="text-xs text-on-surface-variant">{currentInfo.label}</div>
              </div>
            </div>
            <div className="text-right text-xs text-on-surface-variant space-y-1">
              <div>
                <span className="font-semibold text-on-surface">{weather?.humidity}%</span> {getUIText(lang, 'humidity')}
              </div>
              <div>
                <span className="font-semibold text-on-surface">{weather?.wind} km/h</span> {getUIText(lang, 'wind')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 pt-1">
            {weather?.daily.map((item, idx) => {
              const info = getWeatherInfo(item.code);
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center bg-surface-variant/40 rounded-xl py-2 px-1 border border-outline-variant/30"
                >
                  <span className="text-[10px] font-medium text-on-surface-variant mb-1">
                    {item.day}
                  </span>
                  <span className={`material-symbols-outlined text-xl ${info.color} my-0.5`}>
                    {info.icon}
                  </span>
                  <span className="text-xs font-bold text-on-surface">
                    {item.max}° <span className="text-on-surface-variant font-normal">{item.min}°</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
