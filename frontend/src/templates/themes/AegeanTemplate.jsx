import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#1e3a8a', // Deep Aegean Navy
  accentColor: '#65a30d',  // Olive Branch Green
  bgColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headlineFont: "'Playfair Display', serif",
  defaultCover: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Santorini Aegean Odyssey',
  subtitlePrefix: 'Mediterranean Voyage For',
  highlightsTitle: 'Island Experience',
  defaultWelcome: 'Sail across cobalt blue waters and relax on sun-drenched cliffside terraces. Enjoy private yacht charters, exclusive vineyard tastings, and legendary Aegean sunsets.',
  imageKeyword: 'greece santorini sea',
  defaultTourType: 'marine'
};

export default function AegeanTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="aegean" config={CONFIG} data={data} include={include} />;
}
