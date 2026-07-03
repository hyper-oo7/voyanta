import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#831843', // Regal Burgundy
  accentColor: '#ca8a04',  // Antique Gold Leaf
  bgColor: '#ffffff',
  fontFamily: "'Outfit', sans-serif",
  headlineFont: "'Cinzel', serif",
  defaultCover: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Royal Maharaja Heritage',
  subtitlePrefix: 'Palace Expedition For',
  highlightsTitle: 'Royal Chronicle',
  defaultWelcome: 'Live the grandeur of India’s legendary dynasties. Reside in authentic heritage palaces, enjoy private royal elephant polo greetings, and dine in centuries-old courtyards lit by thousands of candles.',
  imageKeyword: 'india palace rajasthan',
  defaultTourType: 'luxury'
};

export default function MaharajaTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="maharaja" config={CONFIG} data={data} include={include} />;
}
