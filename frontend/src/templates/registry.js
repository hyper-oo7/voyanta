import { lazy } from 'react';

// Central Template Registry for Voyanta proposal documents and presentations.
// Every template is a self-contained layout engine receiving the normalized proposal export data.

export const TEMPLATE_REGISTRY = {
  classic: {
    name: 'Classic Elegance',
    category: 'Professional',
    description: 'Timeless layout with clean typography and structured tables.',
    thumbnail: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'luxury', 'general'],
  },
  editorial: {
    name: 'Editorial Magazine',
    category: 'Creative',
    description: 'Vibrant Japanese magazine aesthetic with full-bleed photos, photo grids, and bold typography.',
    thumbnail: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
    bestFor: ['honeymoon', 'adventure', 'family', 'japan'],
    component: lazy(() => import('./editorial/EditorialTemplate.jsx')),
  },
  vibrant: {
    name: 'Vibrant Journey',
    category: 'Bold',
    description: 'High-contrast gradients and modern dark-mode accents designed to WOW clients.',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['beach', 'tropical', 'cruise'],
    component: lazy(() => import('./editorial/EditorialTemplate.jsx')), // Reuses the editorial layout with vibrant color tokens
  },
  modern: {
    name: 'Modern Clean',
    category: 'Professional',
    description: 'Crisp monochrome design focusing on readability and executive summaries.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business'],
  },
  honeymoon: {
    name: 'Honeymoon Suite',
    category: 'Luxury',
    description: 'Dark gold aesthetic tailored for luxury romantic getaways.',
    thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    bestFor: ['honeymoon', 'luxury'],
  },
  family: {
    name: 'Family Retreat',
    category: 'Warm',
    description: 'Warm earth tones and spacious layouts for multi-generational travel.',
    thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=80',
    bestFor: ['family', 'group'],
  },
};

export const TEMPLATE_LIST = Object.entries(TEMPLATE_REGISTRY).map(([slug, meta]) => ({
  slug,
  ...meta,
}));
