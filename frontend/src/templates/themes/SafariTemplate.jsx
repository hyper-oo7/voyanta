import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#c2410c', // Earthy terracotta
  accentColor: '#d97706',  // Safari gold
  bgColor: '#ffffff',      
  fontFamily: "'Outfit', sans-serif",
  headlineFont: "'Cinzel', serif",
  defaultCover: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Serengeti Safari Expedition',
  subtitlePrefix: 'Adventure Prepared Exclusively For',
  highlightsTitle: 'Expedition Overview',
  defaultWelcome: 'Immerse yourself in the untamed elegance of the wild. Our bespoke safari journey brings you face-to-face with breathtaking wildlife while enveloping you in uncompromised luxury.',
  imageKeyword: 'safari wildlife',
  defaultTourType: 'adventure'
};

export default function SafariTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="safari" config={CONFIG} data={data} include={include} />;
}
