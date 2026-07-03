import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#0284c7', // Ice Blue
  accentColor: '#475569',  // Snow Slate Grey
  bgColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headlineFont: "'Outfit', sans-serif",
  defaultCover: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Swiss Alps Luxury Chalet',
  subtitlePrefix: 'Mountain Sanctuary For',
  highlightsTitle: 'Alpine Experience',
  defaultWelcome: 'Escape to crystal-clear mountain air and pristine snowscapes. Experience private ski concierge services, heated alpine chalets, and world-class fireside gastronomy.',
  imageKeyword: 'alps mountains chalet',
  defaultTourType: 'ski'
};

export default function AlpineTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="alpine" config={CONFIG} data={data} include={include} />;
}
