import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#b45309', // Royal Amber Gold
  accentColor: '#ea580c',  // Sunset Orange
  bgColor: '#ffffff',
  fontFamily: "'Outfit', sans-serif",
  headlineFont: "'Cinzel', serif",
  defaultCover: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Arabian Desert Mirage',
  subtitlePrefix: 'Opulent Expedition For',
  highlightsTitle: 'Desert Luxury',
  defaultWelcome: 'Journey into the golden dunes of Arabia where ancient traditions meet futuristic opulence. Experience private desert camps under starlit skies, luxury helicopter transfers, and royal hospitality.',
  imageKeyword: 'desert dunes dubai',
  defaultTourType: 'luxury'
};

export default function DesertTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="desert" config={CONFIG} data={data} include={include} />;
}
