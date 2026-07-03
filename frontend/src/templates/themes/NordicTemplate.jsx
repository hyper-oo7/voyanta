import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#0f172a', // Midnight Fjord Navy
  accentColor: '#10b981',  // Aurora Emerald Green
  bgColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headlineFont: "'Space Grotesk', sans-serif",
  defaultCover: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Nordic Fjord Aurora',
  subtitlePrefix: 'Scandinavian Voyage For',
  highlightsTitle: 'Arctic Expedition',
  defaultWelcome: 'Witness the ethereal dance of the Northern Lights from glass igloo sanctuaries. Glide through dramatic Norwegian fjords on private icebreaker yachts and enjoy bespoke Nordic gastronomy.',
  imageKeyword: 'norway aurora fjord',
  defaultTourType: 'adventure'
};

export default function NordicTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="nordic" config={CONFIG} data={data} include={include} />;
}
