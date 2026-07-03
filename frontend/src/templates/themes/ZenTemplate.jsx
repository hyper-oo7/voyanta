import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#15803d', // Bamboo Sage Green
  accentColor: '#db2777',  // Cherry Blossom Pink
  bgColor: '#ffffff',
  fontFamily: "'Space Grotesk', sans-serif",
  headlineFont: "'Playfair Display', serif",
  defaultCover: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Kyoto Zen Heritage',
  subtitlePrefix: 'Tranquil Journey For',
  highlightsTitle: 'Cultural Immersion',
  defaultWelcome: 'Step into a world of timeless harmony and refined simplicity. From private tea ceremonies in traditional machiyas to serene bamboo forest walks, discover authentic Japan.',
  imageKeyword: 'kyoto japan temple',
  defaultTourType: 'cultural'
};

export default function ZenTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="zen" config={CONFIG} data={data} include={include} />;
}
