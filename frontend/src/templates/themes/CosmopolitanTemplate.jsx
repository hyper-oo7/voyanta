import React from 'react';
import LuxuryThemeEngine from './LuxuryThemeEngine.jsx';

const CONFIG = {
  primaryColor: '#18181b', // Graphite Monochrome
  accentColor: '#06b6d4',  // Electric Cyan
  bgColor: '#ffffff',
  fontFamily: "'Space Grotesk', sans-serif",
  headlineFont: "'Space Grotesk', sans-serif",
  defaultCover: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
  badgeText: 'Cosmopolitan Executive',
  subtitlePrefix: 'Executive Briefing For',
  highlightsTitle: 'Executive Overview',
  defaultWelcome: 'Designed for discerning corporate leaders and urban connoisseurs. Experience seamless helicopter airport transfers, penthouse boardroom access, and reservations at Michelin-starred culinary institutions.',
  imageKeyword: 'skyline city modern',
  defaultTourType: 'corporate'
};

export default function CosmopolitanTemplate({ data, include }) {
  return <LuxuryThemeEngine themeSlug="cosmopolitan" config={CONFIG} data={data} include={include} />;
}
