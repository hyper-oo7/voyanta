import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#0d9488', // Lagoon Turquoise
  accentColor: '#f43f5e',  // Coral Reef Pink
  bgColor: '#ffffff',
  fontFamily: "'Outfit', sans-serif",
  headlineFont: "'Playfair Display', serif",
  defaultCover: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Maldives Tropical Paradise',
  subtitlePrefix: 'Island Sanctuary For',
  highlightsTitle: 'Lagoon Sanctuary',
  defaultWelcome: 'Awaken in an overwater villa suspended above turquoise crystal lagoons. Delight in private sandbank dinners, underwater wine cellars, and tailored marine conservation dives.',
  imageKeyword: 'maldives beach resort',
  defaultTourType: 'honeymoon'
};

export default function TropicTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="tropic" config={CONFIG} data={data} include={include} />;
}
