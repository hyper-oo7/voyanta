// ─────────────────────────────────────────────────────────────────────────────
// Voyanta Template Configuration — JSON-based template definitions.
// Each template is a pure data object that describes how to render a proposal
// without writing any new React components.
// ─────────────────────────────────────────────────────────────────────────────

import { THEME_PRESETS } from './themeEngine.js';
import { DAY_LAYOUT_REGISTRY, SECTION_VARIANTS } from './layoutEngine.js';

// ── Template Config Schema (for validation) ──────────────────────────────────

/**
 * Validates a template configuration object.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validateTemplateConfig(config) {
  const errors = [];
  
  if (!config.id) errors.push('Missing required field: id');
  if (!config.name) errors.push('Missing required field: name');
  if (!config.category) errors.push('Missing required field: category');

  // Validate theme reference
  if (config.theme && typeof config.theme === 'string' && !THEME_PRESETS[config.theme]) {
    errors.push(`Unknown theme reference: ${config.theme}`);
  }

  // Validate day layouts
  if (config.itinerary?.dayLayouts) {
    for (const layoutId of config.itinerary.dayLayouts) {
      if (!DAY_LAYOUT_REGISTRY[layoutId]) {
        errors.push(`Unknown day layout: ${layoutId}`);
      }
    }
  }

  // Validate section variants
  for (const sectionType of ['hero', 'highlights', 'hotels', 'costing', 'inclusions', 'terms', 'cta']) {
    const variant = config[sectionType]?.variant;
    if (variant && SECTION_VARIANTS[sectionType] && !SECTION_VARIANTS[sectionType].includes(variant)) {
      errors.push(`Unknown ${sectionType} variant: ${variant}`);
    }
  }

  return { valid: errors.length === 0, errors };
}


// ── Template Categories ──────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  { id: 'basic',         name: 'Basic',          icon: 'description',    description: 'Clean, professional templates' },
  { id: 'premium',       name: 'Premium',        icon: 'star',           description: 'Rich colors, elevated typography' },
  { id: 'luxury',        name: 'Luxury Magazine', icon: 'auto_awesome',  description: 'Condé Nast quality' },
  { id: 'minimal',       name: 'Minimal Modern', icon: 'space_dashboard',description: 'Swiss design, whitespace' },
  { id: 'corporate',     name: 'Corporate',      icon: 'business_center',description: 'Executive, data-focused' },
  { id: 'honeymoon',     name: 'Honeymoon',      icon: 'favorite',       description: 'Romantic, warm, intimate' },
  { id: 'family',        name: 'Family',         icon: 'family_restroom',description: 'Warm, playful, spacious' },
  { id: 'adventure',     name: 'Adventure',      icon: 'hiking',         description: 'Bold, dramatic, high-energy' },
];


// ── Initial Template Configs ─────────────────────────────────────────────────
// These define 80 templates across 8 categories, all rendered by ConfigDrivenRenderer.

export const TEMPLATE_CONFIGS = {

  // ─────────────────────────────────────────────────────────────────────────
  // PREMIUM (10)
  // ─────────────────────────────────────────────────────────────────────────

  premium_sakura: {
    id: 'premium_sakura',
    name: 'Sakura Bloom',
    category: 'premium',
    description: 'Cherry blossom pink accents with elegant Japanese-inspired editorial design.',
    thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['japan', 'cultural', 'luxury'],
    theme: 'zen_heritage',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['magazine-editorial', 'left-image', 'glass-cards', 'timeline', 'split-screen', 'masonry-gallery', 'right-image', 'bento-grid'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  premium_riviera: {
    id: 'premium_riviera',
    name: 'Amalfi Riviera',
    category: 'premium',
    description: 'Sun-kissed Mediterranean elegance with azure blue and terracotta warmth.',
    thumbnail: 'https://images.unsplash.com/photo-1516483638261-f408892287c4?auto=format&fit=crop&w=600&q=80',
    bestFor: ['italy', 'mediterranean', 'honeymoon', 'luxury'],
    theme: 'aegean_coast',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['full-bleed-image', 'left-image', 'two-column-editorial', 'glass-cards', 'split-screen', 'right-image', 'magazine-editorial', 'hero-image-gallery'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'luxury-cta' },
  },

  premium_aurora: {
    id: 'premium_aurora',
    name: 'Aurora Borealis',
    category: 'premium',
    description: 'Midnight navy and emerald aurora glow for northern adventures.',
    thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['norway', 'iceland', 'nordic', 'arctic'],
    theme: 'nordic_aurora',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'glass-cards' },
    itinerary: { dayLayouts: ['glass-cards', 'split-screen', 'full-bleed-image', 'timeline', 'left-image', 'magazine-editorial', 'floating-cards', 'right-image'] },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  premium_golden_dunes: {
    id: 'premium_golden_dunes',
    name: 'Golden Dunes',
    category: 'premium',
    description: 'Opulent gold and black for luxury Middle Eastern getaways.',
    thumbnail: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80',
    bestFor: ['dubai', 'middle-east', 'luxury', 'desert'],
    theme: 'desert_opulence',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['luxury-card-stack', 'magazine-editorial', 'split-screen', 'full-bleed-image', 'glass-cards', 'left-image', 'bento-grid', 'right-image'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'luxury-cta' },
  },

  premium_lagoon: {
    id: 'premium_lagoon',
    name: 'Crystal Lagoon',
    category: 'premium',
    description: 'Turquoise waters and coral pink for island paradise proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80',
    bestFor: ['maldives', 'tropical', 'beach', 'resort'],
    theme: 'tropical_paradise',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'icon-grid' },
    itinerary: { dayLayouts: ['full-bleed-image', 'glass-cards', 'left-image', 'masonry-gallery', 'split-screen', 'polaroid-style', 'right-image', 'floating-cards'] },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  premium_emerald: {
    id: 'premium_emerald',
    name: 'Emerald Isle',
    category: 'premium',
    description: 'Lush tropical green for Bali, Sri Lanka, and tropical sanctuaries.',
    thumbnail: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80',
    bestFor: ['bali', 'tropical', 'wellness', 'spa'],
    theme: 'tropical_lush',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['top-image', 'left-image', 'glass-cards', 'masonry-gallery', 'split-screen', 'right-image', 'storybook-layout', 'polaroid-style'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  premium_summit: {
    id: 'premium_summit',
    name: 'Alpine Summit',
    category: 'premium',
    description: 'Ice blue and pristine white for mountain resort luxury.',
    thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80',
    bestFor: ['switzerland', 'alps', 'ski', 'winter'],
    theme: 'alpine_frost',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'glass-cards' },
    itinerary: { dayLayouts: ['split-screen', 'full-bleed-image', 'left-image', 'timeline', 'glass-cards', 'right-image', 'magazine-editorial', 'hero-image-gallery'] },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  premium_serengeti: {
    id: 'premium_serengeti',
    name: 'Serengeti Dawn',
    category: 'premium',
    description: 'Warm terracotta and safari gold for African expedition proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80',
    bestFor: ['safari', 'kenya', 'tanzania', 'africa'],
    theme: 'safari_expedition',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['full-bleed-image', 'magazine-editorial', 'left-image', 'bento-grid', 'polaroid-style', 'split-screen', 'right-image', 'storybook-layout'] },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  premium_rajput: {
    id: 'premium_rajput',
    name: 'Rajput Palace',
    category: 'premium',
    description: 'Regal burgundy and antique gold for grand Indian heritage journeys.',
    thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80',
    bestFor: ['india', 'rajasthan', 'heritage', 'palace'],
    theme: 'maharaja_heritage',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['luxury-card-stack', 'magazine-editorial', 'full-bleed-image', 'timeline', 'left-image', 'bento-grid', 'split-screen', 'right-image'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'luxury-cta' },
  },

  premium_canopy: {
    id: 'premium_canopy',
    name: 'Rainforest Canopy',
    category: 'premium',
    description: 'Botanical sage and natural wood for eco-luxury wellness retreats.',
    thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
    bestFor: ['wellness', 'eco', 'costa-rica', 'rainforest'],
    theme: 'eco_sanctuary',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'icon-grid' },
    itinerary: { dayLayouts: ['storybook-layout', 'left-image', 'masonry-gallery', 'timeline', 'top-image', 'right-image', 'glass-cards', 'bottom-gallery'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },


  // ─────────────────────────────────────────────────────────────────────────
  // LUXURY MAGAZINE (10)
  // ─────────────────────────────────────────────────────────────────────────

  luxury_vogue: {
    id: 'luxury_vogue',
    name: 'Vogue Voyager',
    category: 'luxury',
    description: 'High-fashion editorial with dramatic full-bleed photography and serif typography.',
    thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80',
    bestFor: ['luxury', 'europe', 'fashion', 'city'],
    theme: 'european_editorial',
    hero: { variant: 'editorial-cover' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['magazine-editorial', 'three-column-magazine', 'full-bleed-image', 'two-column-editorial', 'luxury-card-stack', 'split-screen', 'hero-image-gallery', 'masonry-gallery'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'luxury-cta' },
  },

  luxury_nat_geo: {
    id: 'luxury_nat_geo',
    name: 'National Explorer',
    category: 'luxury',
    description: 'National Geographic inspired with immersive photography and exploration narratives.',
    thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80',
    bestFor: ['adventure', 'safari', 'wildlife', 'nature'],
    theme: 'safari_expedition',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['full-bleed-image', 'three-column-magazine', 'magazine-editorial', 'masonry-gallery', 'storybook-layout', 'hero-image-gallery', 'bento-grid', 'two-column-editorial'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  luxury_conde_nast: {
    id: 'luxury_conde_nast',
    name: 'Condé Nast Traveler',
    category: 'luxury',
    description: 'Elegant magazine layout with luxurious whitespace and gold accents.',
    thumbnail: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
    bestFor: ['luxury', 'resort', 'spa', 'premium'],
    theme: 'desert_opulence',
    hero: { variant: 'editorial-cover' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['luxury-card-stack', 'two-column-editorial', 'full-bleed-image', 'magazine-editorial', 'glass-cards', 'three-column-magazine', 'hero-image-gallery', 'split-screen'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'full-page' },
    cta: { variant: 'luxury-cta' },
  },

  luxury_archipelago: {
    id: 'luxury_archipelago',
    name: 'Archipelago Dreams',
    category: 'luxury',
    description: 'Turquoise and coral luxury for overwater villa and island resort proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80',
    bestFor: ['maldives', 'seychelles', 'bora-bora', 'island'],
    theme: 'tropical_paradise',
    hero: { variant: 'collage-hero' },
    highlights: { variant: 'glass-cards' },
    itinerary: { dayLayouts: ['floating-cards', 'glass-cards', 'full-bleed-image', 'masonry-gallery', 'split-screen', 'magazine-editorial', 'hero-image-gallery', 'luxury-card-stack'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  luxury_imperial: {
    id: 'luxury_imperial',
    name: 'Imperial Heritage',
    category: 'luxury',
    description: 'Regal Cinzel typography with gold leaf accents for palace and heritage tours.',
    thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80',
    bestFor: ['india', 'rajasthan', 'palace', 'heritage'],
    theme: 'maharaja_heritage',
    hero: { variant: 'editorial-cover' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['magazine-editorial', 'luxury-card-stack', 'full-bleed-image', 'two-column-editorial', 'timeline', 'bento-grid', 'hero-image-gallery', 'three-column-magazine'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'full-page' },
    cta: { variant: 'luxury-cta' },
  },

  luxury_fjord: {
    id: 'luxury_fjord',
    name: 'Fjord Expedition',
    category: 'luxury',
    description: 'Dramatic landscapes with aurora emerald accents and Scandinavian minimalism.',
    thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['norway', 'fjord', 'nordic', 'cruise'],
    theme: 'nordic_aurora',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'glass-cards' },
    itinerary: { dayLayouts: ['full-bleed-image', 'glass-cards', 'three-column-magazine', 'magazine-editorial', 'floating-cards', 'split-screen', 'timeline', 'masonry-gallery'] },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  luxury_zen_garden: {
    id: 'luxury_zen_garden',
    name: 'Zen Garden',
    category: 'luxury',
    description: 'Tranquil Japanese aesthetics with bamboo green and cherry blossom dividers.',
    thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['japan', 'zen', 'wellness', 'cultural'],
    theme: 'zen_heritage',
    hero: { variant: 'editorial-cover' },
    highlights: { variant: 'magazine-spread' },
    itinerary: { dayLayouts: ['storybook-layout', 'magazine-editorial', 'glass-cards', 'full-bleed-image', 'two-column-editorial', 'left-image', 'timeline', 'masonry-gallery'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  luxury_alpine_lodge: {
    id: 'luxury_alpine_lodge',
    name: 'Alpine Lodge',
    category: 'luxury',
    description: 'Premium mountain retreat with frosted glass and ice-blue accents.',
    thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80',
    bestFor: ['switzerland', 'ski', 'alps', 'mountain'],
    theme: 'alpine_frost',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['full-bleed-image', 'glass-cards', 'split-screen', 'magazine-editorial', 'luxury-card-stack', 'hero-image-gallery', 'timeline', 'floating-cards'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'card-pair' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'glass-cta' },
  },

  luxury_emerald_coast: {
    id: 'luxury_emerald_coast',
    name: 'Emerald Coast',
    category: 'luxury',
    description: 'Deep botanical green luxury for tropical wellness and eco retreats.',
    thumbnail: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=600&q=80',
    bestFor: ['bali', 'sri-lanka', 'wellness', 'eco'],
    theme: 'tropical_lush',
    hero: { variant: 'collage-hero' },
    highlights: { variant: 'icon-grid' },
    itinerary: { dayLayouts: ['magazine-editorial', 'floating-cards', 'full-bleed-image', 'glass-cards', 'storybook-layout', 'masonry-gallery', 'split-screen', 'hero-image-gallery'] },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'gradient-cta' },
  },

  luxury_desert_palace: {
    id: 'luxury_desert_palace',
    name: 'Desert Palace',
    category: 'luxury',
    description: 'Black and gold opulence for ultra-luxury Arabian experiences.',
    thumbnail: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=600&q=80',
    bestFor: ['dubai', 'qatar', 'abu-dhabi', 'luxury'],
    theme: 'desert_opulence',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayouts: ['luxury-card-stack', 'full-bleed-image', 'magazine-editorial', 'glass-cards', 'bento-grid', 'split-screen', 'two-column-editorial', 'floating-cards'] },
    hotels: { variant: 'luxury-card-stack' },
    costing: { variant: 'luxury-invoice' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'full-page' },
    cta: { variant: 'luxury-cta' },
  },


  // ─────────────────────────────────────────────────────────────────────────
  // MINIMAL MODERN (10)
  // ─────────────────────────────────────────────────────────────────────────

  minimal_pure: {
    id: 'minimal_pure',
    name: 'Pure Minimal',
    category: 'minimal',
    description: 'Extreme minimalism with generous whitespace and monochrome palette.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business', 'general'],
    theme: 'minimal_modern',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_nordic: {
    id: 'minimal_nordic',
    name: 'Nordic Clean',
    category: 'minimal',
    description: 'Scandinavian-inspired clean design with subtle aurora green accents.',
    thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80',
    bestFor: ['nordic', 'europe', 'wellness'],
    theme: 'nordic_aurora',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_zen: {
    id: 'minimal_zen',
    name: 'Zen Minimal',
    category: 'minimal',
    description: 'Japanese wabi-sabi aesthetics with natural restraint and elegance.',
    thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['japan', 'wellness', 'zen'],
    theme: 'zen_heritage',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_monochrome: {
    id: 'minimal_monochrome',
    name: 'Monochrome',
    category: 'minimal',
    description: 'Stark black and white with bold typographic hierarchy.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business', 'city'],
    theme: { ...null, id: 'monochrome_custom' },
    themeOverrides: {
      colors: { primary: '#000000', accent: '#333333', background: '#ffffff', surface: '#fafafa', surfaceAlt: '#f5f5f5', text: '#000000', textSecondary: '#888888', border: '#e0e0e0' },
    },
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_sand: {
    id: 'minimal_sand',
    name: 'Desert Sand',
    category: 'minimal',
    description: 'Warm sandy neutrals with clean editorial typography.',
    thumbnail: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80',
    bestFor: ['desert', 'beach', 'luxury'],
    theme: 'family_warmth',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_forest: {
    id: 'minimal_forest',
    name: 'Forest Floor',
    category: 'minimal',
    description: 'Muted botanical greens with clean modern structure.',
    thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
    bestFor: ['eco', 'wellness', 'nature'],
    theme: 'eco_sanctuary',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'icon-grid' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'icon-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_ocean: {
    id: 'minimal_ocean',
    name: 'Ocean Breeze',
    category: 'minimal',
    description: 'Soft aqua accents on clean white for resort and beach proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    bestFor: ['beach', 'tropical', 'resort'],
    theme: 'tropical_paradise',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_slate: {
    id: 'minimal_slate',
    name: 'Slate Executive',
    category: 'minimal',
    description: 'Cool slate grey with cyan accents for executive proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'executive', 'business'],
    theme: 'cosmopolitan_exec',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'corporate' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'executive-summary' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'two-column' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_blush: {
    id: 'minimal_blush',
    name: 'Rose Blush',
    category: 'minimal',
    description: 'Delicate rose gold on white for elegant feminine designs.',
    thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    bestFor: ['honeymoon', 'romantic', 'spa'],
    theme: 'romantic_suite',
    themeOverrides: {
      colors: { background: '#ffffff', text: '#1c1917', surface: '#fff5f7', surfaceAlt: '#fef0f3' },
    },
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'editorial-list' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  minimal_arctic: {
    id: 'minimal_arctic',
    name: 'Arctic White',
    category: 'minimal',
    description: 'Crisp white with ice blue touches for clean winter proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80',
    bestFor: ['winter', 'ski', 'alps'],
    theme: 'alpine_frost',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'minimal' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'minimal-breakdown' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },


  // ─────────────────────────────────────────────────────────────────────────
  // CORPORATE (10)
  // ─────────────────────────────────────────────────────────────────────────

  corp_executive: {
    id: 'corp_executive',
    name: 'Executive Brief',
    category: 'corporate',
    description: 'Sharp graphite and cyan for senior leadership travel proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'business', 'executive', 'mice'],
    theme: 'cosmopolitan_exec',
    hero: { variant: 'minimal-text' },
    highlights: { variant: 'numbered-list' },
    itinerary: { dayLayoutPreset: 'corporate' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'executive-summary' },
    inclusions: { variant: 'compact-list' },
    terms: { variant: 'two-column' },
    cta: { variant: 'minimal-cta' },
  },

  corp_boardroom: {
    id: 'corp_boardroom',
    name: 'Boardroom',
    category: 'corporate',
    description: 'Dark professional with data-focused layouts for MICE proposals.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    bestFor: ['corporate', 'conference', 'mice'],
    theme: 'cosmopolitan_exec',
    hero: { variant: 'split-screen' },
    highlights: { variant: 'icon-grid' },
    itinerary: { dayLayoutPreset: 'corporate' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'executive-summary' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'full-page' },
    cta: { variant: 'minimal-cta' },
  },

  corp_skyline: {
    id: 'corp_skyline',
    name: 'City Skyline',
    category: 'corporate',
    description: 'Urban elegance with clean lines for city business travel.',
    thumbnail: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80',
    bestFor: ['city', 'business', 'corporate'],
    theme: 'cosmopolitan_exec',
    hero: { variant: 'full-bleed-cinematic' },
    highlights: { variant: 'editorial-two-column' },
    itinerary: { dayLayoutPreset: 'corporate' },
    hotels: { variant: 'card-grid' },
    costing: { variant: 'glass-table' },
    inclusions: { variant: 'two-column-checklist' },
    terms: { variant: 'minimal-footer' },
    cta: { variant: 'minimal-cta' },
  },

  corp_summit: { id: 'corp_summit', name: 'Summit Conference', category: 'corporate', description: 'Professional conference and incentive travel layouts.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['mice', 'conference', 'incentive'], theme: 'cosmopolitan_exec', hero: { variant: 'split-screen' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'card-grid' }, costing: { variant: 'executive-summary' }, inclusions: { variant: 'compact-list' }, terms: { variant: 'full-page' }, cta: { variant: 'minimal-cta' } },
  corp_diplomat: { id: 'corp_diplomat', name: 'Diplomat', category: 'corporate', description: 'Formal diplomatic style with structured data presentation.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['government', 'diplomatic', 'formal'], theme: 'cosmopolitan_exec', hero: { variant: 'minimal-text' }, highlights: { variant: 'numbered-list' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'card-grid' }, costing: { variant: 'executive-summary' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'full-page' }, cta: { variant: 'minimal-cta' } },
  corp_venture: { id: 'corp_venture', name: 'Venture Capital', category: 'corporate', description: 'Sleek startup aesthetic with bold accents.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['startup', 'tech', 'innovation'], theme: 'nordic_aurora', hero: { variant: 'minimal-text' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  corp_metropolis: { id: 'corp_metropolis', name: 'Metropolis', category: 'corporate', description: 'Bold urban design for large group corporate travel.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['group', 'corporate', 'city'], theme: 'cosmopolitan_exec', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'masonry' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'two-column' }, cta: { variant: 'minimal-cta' } },
  corp_concierge: { id: 'corp_concierge', name: 'VIP Concierge', category: 'corporate', description: 'Premium concierge service feel for executive travel.', thumbnail: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80', bestFor: ['vip', 'executive', 'luxury'], theme: 'desert_opulence', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  corp_global: { id: 'corp_global', name: 'Global Enterprise', category: 'corporate', description: 'Multi-destination corporate travel with clear navigation.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['multi-city', 'corporate', 'global'], theme: 'cosmopolitan_exec', hero: { variant: 'split-screen' }, highlights: { variant: 'numbered-list' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'card-grid' }, costing: { variant: 'executive-summary' }, inclusions: { variant: 'compact-list' }, terms: { variant: 'full-page' }, cta: { variant: 'minimal-cta' } },
  corp_precision: { id: 'corp_precision', name: 'Precision', category: 'corporate', description: 'Data-driven minimalist layouts with clear hierarchy.', thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', bestFor: ['corporate', 'analytical', 'data'], theme: 'minimal_modern', hero: { variant: 'minimal-text' }, highlights: { variant: 'numbered-list' }, itinerary: { dayLayoutPreset: 'corporate' }, hotels: { variant: 'card-grid' }, costing: { variant: 'executive-summary' }, inclusions: { variant: 'compact-list' }, terms: { variant: 'two-column' }, cta: { variant: 'minimal-cta' } },


  // ─────────────────────────────────────────────────────────────────────────
  // HONEYMOON (10)
  // ─────────────────────────────────────────────────────────────────────────

  honey_golden: { id: 'honey_golden', name: 'Golden Romance', category: 'honeymoon', description: 'Dark gold and champagne tones for luxurious romantic getaways.', thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80', bestFor: ['honeymoon', 'romantic', 'luxury'], theme: 'romantic_suite', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  honey_paradise: { id: 'honey_paradise', name: 'Paradise Suite', category: 'honeymoon', description: 'Turquoise waters and romantic sunset hues for island honeymoons.', thumbnail: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80', bestFor: ['maldives', 'honeymoon', 'beach'], theme: 'tropical_paradise', hero: { variant: 'collage-hero' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  honey_tuscany: { id: 'honey_tuscany', name: 'Tuscany Dreams', category: 'honeymoon', description: 'Warm Mediterranean romance with olive and terracotta tones.', thumbnail: 'https://images.unsplash.com/photo-1516483638261-f408892287c4?auto=format&fit=crop&w=600&q=80', bestFor: ['italy', 'tuscany', 'romantic'], theme: 'aegean_coast', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  honey_bali: { id: 'honey_bali', name: 'Bali Bliss', category: 'honeymoon', description: 'Tropical green romance for Bali villa honeymoons.', thumbnail: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80', bestFor: ['bali', 'honeymoon', 'villa'], theme: 'tropical_lush', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  honey_santorini: { id: 'honey_santorini', name: 'Santorini Sunset', category: 'honeymoon', description: 'Aegean blue and white for Greek island honeymoons.', thumbnail: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=600&q=80', bestFor: ['greece', 'santorini', 'island'], theme: 'aegean_coast', hero: { variant: 'collage-hero' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  honey_paris: { id: 'honey_paris', name: 'Parisian Love', category: 'honeymoon', description: 'Elegant Parisian romance with editorial sophistication.', thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80', bestFor: ['paris', 'france', 'romantic'], theme: 'european_editorial', hero: { variant: 'editorial-cover' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  honey_swiss: { id: 'honey_swiss', name: 'Swiss Romance', category: 'honeymoon', description: 'Alpine elegance for mountain honeymoon retreats.', thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80', bestFor: ['switzerland', 'alps', 'romantic'], theme: 'alpine_frost', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  honey_dubai: { id: 'honey_dubai', name: 'Dubai Glamour', category: 'honeymoon', description: 'Black and gold opulence for Dubai luxury honeymoons.', thumbnail: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80', bestFor: ['dubai', 'luxury', 'romantic'], theme: 'desert_opulence', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  honey_japan: { id: 'honey_japan', name: 'Kyoto Romance', category: 'honeymoon', description: 'Zen tranquility for Japanese cultural honeymoons.', thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80', bestFor: ['japan', 'cultural', 'romantic'], theme: 'zen_heritage', hero: { variant: 'editorial-cover' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  honey_seychelles: { id: 'honey_seychelles', name: 'Seychelles Escape', category: 'honeymoon', description: 'Coral reef pink and lagoon blue for exotic island romance.', thumbnail: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80', bestFor: ['seychelles', 'island', 'romantic'], theme: 'tropical_paradise', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'honeymoon' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },


  // ─────────────────────────────────────────────────────────────────────────
  // FAMILY (10)
  // ─────────────────────────────────────────────────────────────────────────

  family_sunshine: { id: 'family_sunshine', name: 'Sunshine Family', category: 'family', description: 'Warm amber tones with spacious, easy-to-read layouts for families.', thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=80', bestFor: ['family', 'kids', 'group'], theme: 'family_warmth', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'two-column' }, cta: { variant: 'gradient-cta' } },
  family_safari: { id: 'family_safari', name: 'Family Safari', category: 'family', description: 'Adventure-meets-comfort for family wildlife holidays.', thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80', bestFor: ['safari', 'family', 'wildlife'], theme: 'safari_expedition', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'two-column' }, cta: { variant: 'gradient-cta' } },
  family_beach: { id: 'family_beach', name: 'Beach Family Fun', category: 'family', description: 'Aqua and sunny tones for family beach resort holidays.', thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', bestFor: ['beach', 'family', 'resort'], theme: 'tropical_paradise', hero: { variant: 'collage-hero' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  family_europe: { id: 'family_europe', name: 'European Discovery', category: 'family', description: 'Classic editorial for family European culture tours.', thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80', bestFor: ['europe', 'family', 'cultural'], theme: 'european_editorial', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  family_mountain: { id: 'family_mountain', name: 'Mountain Retreat', category: 'family', description: 'Alpine blue for family mountain and ski holidays.', thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80', bestFor: ['mountain', 'ski', 'family'], theme: 'alpine_frost', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  family_tropical: { id: 'family_tropical', name: 'Tropical Family', category: 'family', description: 'Lush green tones for Bali and Southeast Asian family vacations.', thumbnail: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80', bestFor: ['bali', 'tropical', 'family'], theme: 'tropical_lush', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  family_japan: { id: 'family_japan', name: 'Japan Family', category: 'family', description: 'Cultural discovery for families exploring Japan.', thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80', bestFor: ['japan', 'cultural', 'family'], theme: 'zen_heritage', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  family_dubai: { id: 'family_dubai', name: 'Dubai Family', category: 'family', description: 'Theme parks and luxury for family Dubai holidays.', thumbnail: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80', bestFor: ['dubai', 'family', 'theme-park'], theme: 'desert_opulence', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'two-column' }, cta: { variant: 'gradient-cta' } },
  family_india: { id: 'family_india', name: 'India Heritage Family', category: 'family', description: 'Heritage and culture for multi-generational India tours.', thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80', bestFor: ['india', 'heritage', 'family'], theme: 'maharaja_heritage', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'two-column' }, cta: { variant: 'luxury-cta' } },
  family_eco: { id: 'family_eco', name: 'Eco Family', category: 'family', description: 'Nature and wildlife for eco-conscious family travel.', thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80', bestFor: ['eco', 'nature', 'family'], theme: 'eco_sanctuary', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'family' }, hotels: { variant: 'card-grid' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },


  // ─────────────────────────────────────────────────────────────────────────
  // ADVENTURE (10)
  // ─────────────────────────────────────────────────────────────────────────

  adv_expedition: { id: 'adv_expedition', name: 'Bold Expedition', category: 'adventure', description: 'High-energy orange and dark slate for extreme adventure proposals.', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', bestFor: ['adventure', 'trekking', 'hiking'], theme: 'adventure_bold', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_arctic: { id: 'adv_arctic', name: 'Arctic Explorer', category: 'adventure', description: 'Ice and aurora for Arctic and polar expedition proposals.', thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80', bestFor: ['arctic', 'polar', 'expedition'], theme: 'nordic_aurora', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  adv_safari: { id: 'adv_safari', name: 'Wild Safari', category: 'adventure', description: 'Rugged safari adventure with dramatic photography layouts.', thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80', bestFor: ['safari', 'wildlife', 'adventure'], theme: 'safari_expedition', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_mountain: { id: 'adv_mountain', name: 'Mountain Summit', category: 'adventure', description: 'Alpine adventure with dramatic peak photography.', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', bestFor: ['trekking', 'mountain', 'hiking'], theme: 'alpine_frost', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  adv_jungle: { id: 'adv_jungle', name: 'Jungle Trek', category: 'adventure', description: 'Deep forest green for jungle and rainforest adventures.', thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80', bestFor: ['jungle', 'rainforest', 'adventure'], theme: 'eco_sanctuary', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_ocean: { id: 'adv_ocean', name: 'Ocean Diver', category: 'adventure', description: 'Deep aqua for diving and marine adventure proposals.', thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', bestFor: ['diving', 'marine', 'surfing'], theme: 'tropical_paradise', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  adv_desert: { id: 'adv_desert', name: 'Desert Quest', category: 'adventure', description: 'Golden desert adventure with dune exploration themes.', thumbnail: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80', bestFor: ['desert', 'dune', 'adventure'], theme: 'desert_opulence', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_volcano: { id: 'adv_volcano', name: 'Volcanic Trail', category: 'adventure', description: 'Fiery orange and dark landscapes for volcanic adventure.', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', bestFor: ['volcano', 'iceland', 'geological'], theme: 'adventure_bold', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_river: { id: 'adv_river', name: 'River Expedition', category: 'adventure', description: 'River rafting and expedition adventure layouts.', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', bestFor: ['river', 'rafting', 'adventure'], theme: 'tropical_lush', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'card-grid' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  adv_cultural: { id: 'adv_cultural', name: 'Cultural Adventure', category: 'adventure', description: 'Heritage exploration with adventurous spirit.', thumbnail: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80', bestFor: ['cultural', 'heritage', 'adventure'], theme: 'maharaja_heritage', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'adventure' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },


  // ─────────────────────────────────────────────────────────────────────────
  // CULTURAL & WELLNESS (10)
  // ─────────────────────────────────────────────────────────────────────────

  cult_zen: { id: 'cult_zen', name: 'Kyoto Zen Retreat', category: 'cultural', description: 'Tranquil Japanese aesthetics for mindfulness and meditation journeys.', thumbnail: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80', bestFor: ['japan', 'zen', 'meditation'], theme: 'zen_heritage', hero: { variant: 'editorial-cover' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'cultural' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  cult_ayurveda: { id: 'cult_ayurveda', name: 'Ayurvedic Sanctuary', category: 'wellness', description: 'Warm botanical green for holistic health and Ayurvedic retreats.', thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80', bestFor: ['kerala', 'ayurveda', 'wellness'], theme: 'eco_sanctuary', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'wellness' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  cult_bali: { id: 'cult_bali', name: 'Bali Yoga & Spa', category: 'wellness', description: 'Lush tropical tranquility for Ubud yoga and spa immersions.', thumbnail: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80', bestFor: ['bali', 'yoga', 'spa'], theme: 'tropical_lush', hero: { variant: 'collage-hero' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'wellness' }, hotels: { variant: 'card-grid' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  cult_machu: { id: 'cult_machu', name: 'Sacred Valley Heritage', category: 'cultural', description: 'Deep earth tones and Andean storytelling for historical expeditions.', thumbnail: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80', bestFor: ['peru', 'heritage', 'incan'], theme: 'maharaja_heritage', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'cultural' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
  cult_silk: { id: 'cult_silk', name: 'Silk Road Odyssey', category: 'cultural', description: 'Rich spices and terracotta architecture for Central Asian cultural tours.', thumbnail: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80', bestFor: ['uzbekistan', 'silk-road', 'cultural'], theme: 'desert_opulence', hero: { variant: 'split-screen' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'cultural' }, hotels: { variant: 'card-grid' }, costing: { variant: 'category-cards' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'two-column' }, cta: { variant: 'gradient-cta' } },
  cult_nordic: { id: 'cult_nordic', name: 'Nordic Thermal Bath', category: 'wellness', description: 'Ice blue and volcanic steam for Icelandic geothermal spa retreats.', thumbnail: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&q=80', bestFor: ['iceland', 'thermal', 'spa'], theme: 'nordic_aurora', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'glass-cards' }, itinerary: { dayLayoutPreset: 'wellness' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'glass-table' }, inclusions: { variant: 'card-pair' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'glass-cta' } },
  cult_bhutan: { id: 'cult_bhutan', name: 'Himalayan Sanctuary', category: 'wellness', description: 'Spiritual mountain serenity for Bhutan monastery and wellness tours.', thumbnail: 'https://images.unsplash.com/photo-1502784444167-3a13146b2b71?auto=format&fit=crop&w=600&q=80', bestFor: ['bhutan', 'himalaya', 'spiritual'], theme: 'alpine_frost', hero: { variant: 'editorial-cover' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'wellness' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  cult_egypt: { id: 'cult_egypt', name: 'Pharaohs & Pyramids', category: 'cultural', description: 'Golden sands and monumental architecture for Egyptian antiquities.', thumbnail: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=600&q=80', bestFor: ['egypt', 'heritage', 'archaeology'], theme: 'desert_opulence', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'magazine-spread' }, itinerary: { dayLayoutPreset: 'cultural' }, hotels: { variant: 'luxury-card-stack' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'two-column' }, cta: { variant: 'luxury-cta' } },
  cult_costa: { id: 'cult_costa', name: 'Rainforest Eco Wellness', category: 'wellness', description: 'Botanical green and sustainable luxury for Costa Rican yoga and detox.', thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80', bestFor: ['costa-rica', 'eco', 'wellness'], theme: 'eco_sanctuary', hero: { variant: 'full-bleed-cinematic' }, highlights: { variant: 'icon-grid' }, itinerary: { dayLayoutPreset: 'wellness' }, hotels: { variant: 'card-grid' }, costing: { variant: 'minimal-breakdown' }, inclusions: { variant: 'icon-list' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'gradient-cta' } },
  cult_tuscany: { id: 'cult_tuscany', name: 'Tuscan Wine & Culinary', category: 'cultural', description: 'Vineyard terracotta and gastronomic storytelling for Italian food & culture.', thumbnail: 'https://images.unsplash.com/photo-1516483638261-f408892287c4?auto=format&fit=crop&w=600&q=80', bestFor: ['italy', 'wine', 'culinary'], theme: 'aegean_coast', hero: { variant: 'editorial-cover' }, highlights: { variant: 'editorial-two-column' }, itinerary: { dayLayoutPreset: 'cultural' }, hotels: { variant: 'editorial-list' }, costing: { variant: 'luxury-invoice' }, inclusions: { variant: 'two-column-checklist' }, terms: { variant: 'minimal-footer' }, cta: { variant: 'luxury-cta' } },
};


/**
 * Returns all template configs as a flat array for UI listing.
 */
export function getTemplateConfigList() {
  return Object.values(TEMPLATE_CONFIGS).map(config => ({
    id: config.id,
    name: config.name,
    category: config.category,
    description: config.description,
    thumbnail: config.thumbnail,
    bestFor: config.bestFor,
  }));
}

/**
 * Returns template configs filtered by category.
 */
export function getTemplatesByCategory(categoryId) {
  return Object.values(TEMPLATE_CONFIGS).filter(c => c.category === categoryId);
}

/**
 * Gets a single template config by ID.
 */
export function getTemplateConfig(templateId) {
  return TEMPLATE_CONFIGS[templateId] || null;
}
