import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#166534', // Botanical Sage Green
  accentColor: '#a16207',  // Bamboo Wood Taupe
  bgColor: '#ffffff',
  fontFamily: "'Outfit', sans-serif",
  headlineFont: "'Playfair Display', serif",
  defaultCover: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Rainforest Eco Sanctuary',
  subtitlePrefix: 'Wellness Sanctuary For',
  highlightsTitle: 'Sanctuary Overview',
  defaultWelcome: 'Reconnect with nature without sacrificing an ounce of luxury. Reside in eco-architectural treetop villas, indulge in organic spa therapies, and explore private rainforest preserves with naturalist guides.',
  imageKeyword: 'rainforest jungle resort',
  defaultTourType: 'wellness'
};

export default function EcoSanctuaryTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="eco_sanctuary" config={CONFIG} data={data} include={include} />;
}
