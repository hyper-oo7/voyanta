// ─────────────────────────────────────────────────────────────────────────────
// Voyanta Layout Engine — Resolves template JSON configs into renderable
// component references. Handles section ordering, day layout rotation,
// page break management, and component variant selection.
// ─────────────────────────────────────────────────────────────────────────────

// ── Available Day Layouts ────────────────────────────────────────────────────
// Each key maps to a React component in templates/dayLayouts/

export const DAY_LAYOUT_REGISTRY = {
  'left-image':            { name: 'Left Image',           complexity: 'simple' },
  'right-image':           { name: 'Right Image',          complexity: 'simple' },
  'top-image':             { name: 'Top Image',            complexity: 'simple' },
  'bottom-gallery':        { name: 'Bottom Gallery',       complexity: 'medium' },
  'masonry-gallery':       { name: 'Masonry Gallery',      complexity: 'medium' },
  'pinterest-style':       { name: 'Pinterest Style',      complexity: 'complex' },
  'magazine-editorial':    { name: 'Magazine Editorial',   complexity: 'complex' },
  'timeline':              { name: 'Timeline',             complexity: 'medium' },
  'split-screen':          { name: 'Split Screen',         complexity: 'simple' },
  'floating-cards':        { name: 'Floating Cards',       complexity: 'complex' },
  'glass-cards':           { name: 'Glass Cards',          complexity: 'medium' },
  'bento-grid':            { name: 'Bento Grid',           complexity: 'complex' },
  'polaroid-style':        { name: 'Polaroid Style',       complexity: 'medium' },
  'luxury-card-stack':     { name: 'Luxury Card Stack',    complexity: 'complex' },
  'alternating-layout':    { name: 'Alternating Layout',   complexity: 'simple' },
  'full-bleed-image':      { name: 'Full Bleed Image',     complexity: 'simple' },
  'hero-image-gallery':    { name: 'Hero + Gallery',       complexity: 'medium' },
  'two-column-editorial':  { name: 'Two Column Editorial', complexity: 'complex' },
  'three-column-magazine': { name: 'Three Column Magazine',complexity: 'complex' },
  'storybook-layout':      { name: 'Storybook Layout',    complexity: 'medium' },
};

// ── Available Section Variants ───────────────────────────────────────────────

export const SECTION_VARIANTS = {
  hero: [
    'full-bleed-cinematic',    // Full-screen background image with gradient overlay
    'split-screen',            // 50/50 image and text split
    'minimal-text',            // Minimal text-focused hero
    'collage-hero',            // Multi-image collage behind text
    'editorial-cover',         // Magazine cover style
  ],
  highlights: [
    'editorial-two-column',    // Text left, key highlights card right
    'icon-grid',               // Grid of icon + stat cards
    'magazine-spread',         // Full editorial spread with pull quote
    'glass-cards',             // Glassmorphic stat cards
    'numbered-list',           // Numbered key highlights
  ],
  hotels: [
    'card-grid',               // 2-column card grid with images
    'luxury-card-stack',       // Overlapping stacked cards
    'editorial-list',          // Large image + detailed text per hotel
    'masonry',                 // Masonry grid
    'single-focus',            // One featured + rest compact
  ],
  costing: [
    'glass-table',             // Glassmorphic table design
    'minimal-breakdown',       // Clean minimal table
    'luxury-invoice',          // Premium invoice styling
    'category-cards',          // Each category as a card
    'executive-summary',       // Summary card + detailed breakdown
  ],
  inclusions: [
    'two-column-checklist',    // Side-by-side included/excluded
    'icon-list',               // Icons with each item
    'card-pair',               // Two cards: included vs excluded
    'compact-list',            // Space-efficient list
  ],
  terms: [
    'minimal-footer',          // Compact footer-style terms
    'full-page',               // Full dedicated page
    'two-column',              // Two column layout
    'accordion-style',         // Collapsible sections (web preview only)
  ],
  cta: [
    'gradient-cta',            // Gradient background CTA
    'glass-cta',               // Glassmorphic CTA
    'minimal-cta',             // Simple text CTA
    'luxury-cta',              // Dark premium CTA
    'split-cta',               // Split image + CTA
  ],
};

// ── Default Day Layout Rotations ─────────────────────────────────────────────
// Predefined layout sequences that create variety without repetition.

export const DAY_LAYOUT_PRESETS = {
  editorial: [
    'magazine-editorial', 'left-image', 'masonry-gallery', 'timeline',
    'split-screen', 'right-image', 'glass-cards', 'bento-grid',
  ],
  luxury: [
    'full-bleed-image', 'luxury-card-stack', 'magazine-editorial', 'glass-cards',
    'hero-image-gallery', 'split-screen', 'floating-cards', 'two-column-editorial',
  ],
  minimal: [
    'left-image', 'right-image', 'top-image', 'split-screen',
    'alternating-layout', 'left-image', 'timeline', 'right-image',
  ],
  adventure: [
    'full-bleed-image', 'bento-grid', 'magazine-editorial', 'polaroid-style',
    'masonry-gallery', 'split-screen', 'floating-cards', 'storybook-layout',
  ],
  family: [
    'top-image', 'polaroid-style', 'bottom-gallery', 'timeline',
    'bento-grid', 'left-image', 'masonry-gallery', 'storybook-layout',
  ],
  corporate: [
    'left-image', 'right-image', 'timeline', 'split-screen',
    'top-image', 'alternating-layout', 'left-image', 'right-image',
  ],
  honeymoon: [
    'full-bleed-image', 'glass-cards', 'magazine-editorial', 'luxury-card-stack',
    'hero-image-gallery', 'floating-cards', 'split-screen', 'two-column-editorial',
  ],
  mixed: [
    'magazine-editorial', 'left-image', 'bento-grid', 'timeline',
    'glass-cards', 'right-image', 'full-bleed-image', 'polaroid-style',
    'masonry-gallery', 'split-screen', 'floating-cards', 'storybook-layout',
    'luxury-card-stack', 'top-image', 'two-column-editorial', 'alternating-layout',
    'bottom-gallery', 'hero-image-gallery', 'three-column-magazine', 'pinterest-style',
  ],
};


// ── Layout Resolution ────────────────────────────────────────────────────────

/**
 * Resolves the full layout plan for a proposal template.
 * 
 * @param {Object} templateConfig - The JSON template configuration
 * @param {number} dayCount - Number of days in the itinerary
 * @returns {Object} Resolved layout plan with component variants and day layouts
 */
export function resolveLayout(templateConfig, dayCount = 0) {
  const config = (templateConfig && typeof templateConfig === 'object') ? templateConfig : {};

  // Resolve section variants
  const sections = {
    hero:        resolveVariant('hero', config.hero?.variant),
    highlights:  resolveVariant('highlights', config.highlights?.variant),
    hotels:      resolveVariant('hotels', config.hotels?.variant),
    costing:     resolveVariant('costing', config.costing?.variant),
    inclusions:  resolveVariant('inclusions', config.inclusions?.variant),
    terms:       resolveVariant('terms', config.terms?.variant),
    cta:         resolveVariant('cta', config.cta?.variant),
  };

  // Resolve section order
  const sectionOrder = config.sections || [
    'hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'terms', 'cta',
  ];

  // Resolve day layout rotation
  const dayLayouts = resolveDayLayouts(config, dayCount);

  return {
    sections,
    sectionVariants: sections,
    sectionOrder,
    dayLayouts,
    dayLayoutSequence: dayLayouts,
    // Page break configuration
    pageBreaks: {
      afterHero: config.pageBreaks?.afterHero ?? true,
      afterItinerary: config.pageBreaks?.afterItinerary ?? false,
      afterHotels: config.pageBreaks?.afterHotels ?? false,
      beforeCosting: config.pageBreaks?.beforeCosting ?? true,
    },
  };
}

/**
 * Resolves the variant for a given section type, falling back to the first available variant.
 */
function resolveVariant(sectionType, requestedVariant) {
  const available = SECTION_VARIANTS[sectionType] || [];
  if (requestedVariant && available.includes(requestedVariant)) {
    return requestedVariant;
  }
  return available[0] || 'default';
}

/**
 * Resolves day layouts for each day, using the template's configured rotation
 * or a default preset. Never repeats the same layout for consecutive days.
 */
function resolveDayLayouts(config, dayCount) {
  if (dayCount === 0) return [];

  let layouts;
  
  if (config.itinerary?.dayLayouts && Array.isArray(config.itinerary.dayLayouts)) {
    layouts = config.itinerary.dayLayouts;
  } else if (config.itinerary?.dayLayoutPreset) {
    layouts = DAY_LAYOUT_PRESETS[config.itinerary.dayLayoutPreset] || DAY_LAYOUT_PRESETS.mixed;
  } else {
    layouts = DAY_LAYOUT_PRESETS.editorial;
  }

  // Map each day to a layout, cycling through the array
  const result = [];
  for (let i = 0; i < dayCount; i++) {
    const layoutId = layouts[i % layouts.length];
    // Verify the layout exists in the registry
    if (DAY_LAYOUT_REGISTRY[layoutId]) {
      result.push(layoutId);
    } else {
      result.push('left-image'); // Safe fallback
    }
  }

  return result;
}

/**
 * Returns all available day layout IDs and names for UI selectors.
 */
export function getDayLayoutList() {
  return Object.entries(DAY_LAYOUT_REGISTRY).map(([id, meta]) => ({
    id,
    ...meta,
  }));
}

/**
 * Returns all available section variants for a given section type.
 */
export function getSectionVariants(sectionType) {
  return SECTION_VARIANTS[sectionType] || [];
}
