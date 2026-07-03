import { lazy } from 'react';
import { TEMPLATE_CONFIGS } from './engine/templateConfig.js';

// Central Template Registry for Voyanta proposal documents and presentations.
// Every template is a self-contained layout engine receiving the normalized proposal export data.

const ConfigDrivenComponent = lazy(() => import('./engine/ConfigDrivenRenderer.jsx'));

export const TEMPLATE_REGISTRY = {
  // ─── Basic Tier (Legacy Templates) ──────────────────────────────────────────
  classic: {
    name: 'Classic Elegance',
    category: 'Professional',
    tier: 'Basic',
    description: 'Timeless layout with clean typography and structured tables.',
    thumbnail: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'luxury', 'general'],
  },
  editorial: {
    name: 'Editorial Magazine',
    category: 'Creative',
    tier: 'Basic',
    description: 'Vibrant Japanese magazine aesthetic with full-bleed photos, photo grids, and bold typography.',
    thumbnail: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
    bestFor: ['honeymoon', 'adventure', 'family', 'japan'],
    component: lazy(() => import('./editorial/EditorialTemplate.jsx')),
  },
  vibrant: {
    name: 'Vibrant Journey',
    category: 'Bold',
    tier: 'Basic',
    description: 'High-contrast gradients and modern dark-mode accents designed to WOW clients.',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['beach', 'tropical', 'cruise'],
    component: lazy(() => import('./editorial/EditorialTemplate.jsx')),
  },
  modern: {
    name: 'Modern Clean',
    category: 'Professional',
    tier: 'Basic',
    description: 'Crisp monochrome design focusing on readability and executive summaries.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business'],
  },
  honeymoon: {
    name: 'Honeymoon Suite',
    category: 'Luxury',
    tier: 'Basic',
    description: 'Dark gold aesthetic tailored for luxury romantic getaways.',
    thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    bestFor: ['honeymoon', 'luxury'],
  },
  family: {
    name: 'Family Retreat',
    category: 'Warm',
    tier: 'Basic',
    description: 'Warm earth tones and spacious layouts for multi-generational travel.',
    thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=80',
    bestFor: ['family', 'group'],
  },
  safari: {
    name: 'Serengeti Expedition',
    category: 'Adventure',
    tier: 'Basic',
    description: 'Earthy terracotta and safari gold tones with wildlife headers and adventure layouts.',
    thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80',
    bestFor: ['safari', 'adventure', 'wildlife', 'africa'],
    component: lazy(() => import('./themes/SafariTemplate.jsx')),
  },
  alpine: {
    name: 'Swiss Alps Chalet',
    category: 'Luxury',
    tier: 'Basic',
    description: 'Crisp ice blue and snow slate styling tailored for mountain resorts and ski retreats.',
    thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80',
    bestFor: ['ski', 'alps', 'winter', 'switzerland'],
    component: lazy(() => import('./themes/AlpineTemplate.jsx')),
  },
  zen: {
    name: 'Kyoto Zen Heritage',
    category: 'Cultural',
    tier: 'Basic',
    description: 'Bamboo sage green and cherry blossom accents with tranquil Japanese aesthetics.',
    thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['japan', 'cultural', 'heritage', 'wellness'],
    component: lazy(() => import('./themes/ZenTemplate.jsx')),
  },
  aegean: {
    name: 'Santorini Odyssey',
    category: 'Luxury',
    tier: 'Basic',
    description: 'Deep Aegean navy blue and olive accents with Mediterranean coastal luxury cards.',
    thumbnail: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=600&q=80',
    bestFor: ['greece', 'island', 'mediterranean', 'marine'],
    component: lazy(() => import('./themes/AegeanTemplate.jsx')),
  },
  desert: {
    name: 'Arabian Desert Mirage',
    category: 'Opulence',
    tier: 'Basic',
    description: 'Royal amber gold and sunset orange tones with Middle Eastern luxury styling.',
    thumbnail: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80',
    bestFor: ['dubai', 'middle-east', 'luxury', 'desert'],
    component: lazy(() => import('./themes/DesertTemplate.jsx')),
  },
  nordic: {
    name: 'Nordic Fjord Aurora',
    category: 'Adventure',
    tier: 'Basic',
    description: 'Midnight navy and aurora emerald green with Scandinavian minimalist elegance.',
    thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['norway', 'nordic', 'aurora', 'arctic'],
    component: lazy(() => import('./themes/NordicTemplate.jsx')),
  },
  tropic: {
    name: 'Maldives Paradise',
    category: 'Honeymoon',
    tier: 'Basic',
    description: 'Lagoon turquoise and coral reef pink accents for island resort getaways.',
    thumbnail: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80',
    bestFor: ['maldives', 'tropical', 'beach', 'resort'],
    component: lazy(() => import('./themes/TropicTemplate.jsx')),
  },
  maharaja: {
    name: 'Royal Maharaja Heritage',
    category: 'Heritage',
    tier: 'Basic',
    description: 'Regal burgundy and antique gold leaf accents for grand palace journeys.',
    thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80',
    bestFor: ['india', 'heritage', 'palace', 'luxury'],
    component: lazy(() => import('./themes/MaharajaTemplate.jsx')),
  },
  cosmopolitan: {
    name: 'Cosmopolitan Executive',
    category: 'Executive',
    tier: 'Basic',
    description: 'Sleek graphite monochrome and electric cyan for urban corporate travel.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business', 'city', 'executive'],
    component: lazy(() => import('./themes/CosmopolitanTemplate.jsx')),
  },
  eco_sanctuary: {
    name: 'Rainforest Sanctuary',
    category: 'Wellness',
    tier: 'Basic',
    description: 'Botanical sage green and natural wood taupe for eco-luxury wellness retreats.',
    thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
    bestFor: ['wellness', 'eco', 'rainforest', 'costa-rica'],
    component: lazy(() => import('./themes/EcoSanctuaryTemplate.jsx')),
  },
};

// ─── Register 80+ New Magazine-Quality Templates ──────────────────────────────
Object.entries(TEMPLATE_CONFIGS).forEach(([slug, config]) => {
  if (!TEMPLATE_REGISTRY[slug]) {
    TEMPLATE_REGISTRY[slug] = {
      name: config.name,
      category: config.category,
      tier: config.tier || 'Premium',
      description: config.description,
      thumbnail: config.thumbnail || 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80',
      bestFor: config.tags || [config.category],
      component: ConfigDrivenComponent,
    };
  }
});

export const TEMPLATE_LIST = Object.entries(TEMPLATE_REGISTRY).map(([slug, meta]) => ({
  slug,
  ...meta,
}));

