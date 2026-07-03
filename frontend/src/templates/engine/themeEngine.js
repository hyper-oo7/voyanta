// ─────────────────────────────────────────────────────────────────────────────
// Voyanta Theme Engine — Rich, structured theme definitions for proposal rendering.
// Each theme specifies colors, typography, effects, and decorative styles.
// The resolver auto-selects the best theme based on destination, tour type, and season.
// ─────────────────────────────────────────────────────────────────────────────

// ── Theme Definitions ────────────────────────────────────────────────────────

export const THEME_PRESETS = {
  // ─── Japan / Zen ───────────────────────────────────────────────────────
  zen_heritage: {
    id: 'zen_heritage',
    name: 'Kyoto Zen Heritage',
    colors: {
      primary: '#2d1b2e',
      accent: '#c41e3a',
      background: '#ffffff',
      surface: '#faf8f5',
      surfaceAlt: '#f5f0eb',
      text: '#1a1a1a',
      textSecondary: '#64748b',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#e8e2da',
      gradient: 'linear-gradient(135deg, #2d1b2e 0%, #c41e3a 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(45,27,46,0.65) 0%, rgba(45,27,46,0.2) 40%, rgba(45,27,46,0.85) 100%)',
      cardGlow: 'rgba(196,30,58,0.08)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Cormorant Garamond", serif',
      body: '"Inter", sans-serif',
      accent: '"Cinzel", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 8px 32px rgba(0,0,0,0.06)',
      cardHoverShadow: '0 16px 48px rgba(0,0,0,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.7)',
      glassBlur: '12px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'elegant-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(0,0,0,0.03)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'pill',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Maldives / Tropical Paradise ──────────────────────────────────────
  tropical_paradise: {
    id: 'tropical_paradise',
    name: 'Maldives Paradise',
    colors: {
      primary: '#0e7490',
      accent: '#f472b6',
      background: '#ffffff',
      surface: '#f0fdfa',
      surfaceAlt: '#ecfeff',
      text: '#042f2e',
      textSecondary: '#5eead4',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#99f6e4',
      gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 50%, #f472b6 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(14,116,144,0.5) 0%, rgba(0,0,0,0.15) 40%, rgba(14,116,144,0.8) 100%)',
      cardGlow: 'rgba(6,182,212,0.1)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Outfit", sans-serif',
      sizes: {
        heroTitle: '4.5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.25rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.125rem', cardBody: '0.875rem',
        dayNumber: '4rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 500, body: 400, accent: 600 },
    },
    effects: {
      cardShadow: '0 4px 24px rgba(14,116,144,0.08)',
      cardHoverShadow: '0 12px 40px rgba(14,116,144,0.15)',
      glassMorphism: true,
      glassBackground: 'rgba(255,255,255,0.65)',
      glassBlur: '16px',
      borderRadius: '1.25rem',
      borderRadiusSmall: '0.75rem',
      borderRadiusLarge: '2rem',
      sectionDivider: 'wave',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(14,116,144,0.05)',
    },
    decorations: {
      iconStyle: 'rounded',
      badgeStyle: 'pill',
      dayNumberStyle: 'circle',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Switzerland / Alpine ──────────────────────────────────────────────
  alpine_frost: {
    id: 'alpine_frost',
    name: 'Swiss Alpine Chalet',
    colors: {
      primary: '#0c4a6e',
      accent: '#0ea5e9',
      background: '#ffffff',
      surface: '#f0f9ff',
      surfaceAlt: '#e0f2fe',
      text: '#0f172a',
      textSecondary: '#64748b',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#bae6fd',
      gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(12,74,110,0.6) 0%, rgba(0,0,0,0.15) 40%, rgba(12,74,110,0.85) 100%)',
      cardGlow: 'rgba(14,165,233,0.08)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Space Grotesk", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Cinzel", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '4.5rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 6px 24px rgba(12,74,110,0.06)',
      cardHoverShadow: '0 12px 40px rgba(12,74,110,0.12)',
      glassMorphism: true,
      glassBackground: 'rgba(255,255,255,0.75)',
      glassBlur: '14px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'gradient-fade',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(12,74,110,0.04)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'square',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3.5rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Dubai / Desert Opulence ───────────────────────────────────────────
  desert_opulence: {
    id: 'desert_opulence',
    name: 'Arabian Desert Mirage',
    colors: {
      primary: '#1c1917',
      accent: '#d97706',
      background: '#ffffff',
      surface: '#fffbeb',
      surfaceAlt: '#fef3c7',
      text: '#1c1917',
      textSecondary: '#78716c',
      textOnPrimary: '#d97706',
      textOnAccent: '#1c1917',
      border: '#fde68a',
      gradient: 'linear-gradient(135deg, #1c1917 0%, #d97706 60%, #f59e0b 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(28,25,23,0.7) 0%, rgba(28,25,23,0.2) 40%, rgba(28,25,23,0.9) 100%)',
      cardGlow: 'rgba(217,119,6,0.08)',
    },
    typography: {
      headline: '"Cinzel", serif',
      subhead: '"Cormorant Garamond", serif',
      body: '"Inter", sans-serif',
      accent: '"Cinzel", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.125rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.8125rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.625rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 8px 32px rgba(28,25,23,0.08)',
      cardHoverShadow: '0 16px 48px rgba(28,25,23,0.16)',
      glassMorphism: false,
      glassBackground: 'rgba(255,251,235,0.8)',
      glassBlur: '12px',
      borderRadius: '0.75rem',
      borderRadiusSmall: '0.375rem',
      borderRadiusLarge: '1.25rem',
      sectionDivider: 'ornamental',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(217,119,6,0.05)',
    },
    decorations: {
      iconStyle: 'sharp',
      badgeStyle: 'ribbon',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '900px',
    },
  },

  // ─── Bali / Tropical Lush ─────────────────────────────────────────────
  tropical_lush: {
    id: 'tropical_lush',
    name: 'Bali Tropical Sanctuary',
    colors: {
      primary: '#14532d',
      accent: '#22c55e',
      background: '#ffffff',
      surface: '#f0fdf4',
      surfaceAlt: '#dcfce7',
      text: '#14532d',
      textSecondary: '#4ade80',
      textOnPrimary: '#ffffff',
      textOnAccent: '#14532d',
      border: '#86efac',
      gradient: 'linear-gradient(135deg, #14532d 0%, #22c55e 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(20,83,45,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(20,83,45,0.8) 100%)',
      cardGlow: 'rgba(34,197,94,0.08)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Outfit", sans-serif',
      sizes: {
        heroTitle: '4.5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.25rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.125rem', cardBody: '0.875rem',
        dayNumber: '4rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 500, body: 400, accent: 600 },
    },
    effects: {
      cardShadow: '0 4px 24px rgba(20,83,45,0.06)',
      cardHoverShadow: '0 12px 40px rgba(20,83,45,0.12)',
      glassMorphism: true,
      glassBackground: 'rgba(255,255,255,0.6)',
      glassBlur: '16px',
      borderRadius: '1.25rem',
      borderRadiusSmall: '0.75rem',
      borderRadiusLarge: '2rem',
      sectionDivider: 'wave',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(20,83,45,0.04)',
    },
    decorations: {
      iconStyle: 'rounded',
      badgeStyle: 'pill',
      dayNumberStyle: 'circle',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Greece / Aegean ───────────────────────────────────────────────────
  aegean_coast: {
    id: 'aegean_coast',
    name: 'Santorini Odyssey',
    colors: {
      primary: '#1e3a8a',
      accent: '#3b82f6',
      background: '#ffffff',
      surface: '#eff6ff',
      surfaceAlt: '#dbeafe',
      text: '#1e293b',
      textSecondary: '#64748b',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#bfdbfe',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(30,58,138,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(30,58,138,0.8) 100%)',
      cardGlow: 'rgba(59,130,246,0.08)',
    },
    typography: {
      headline: '"Cormorant Garamond", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Playfair Display", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '4.5rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 600, subhead: 500, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 4px 20px rgba(30,58,138,0.06)',
      cardHoverShadow: '0 12px 36px rgba(30,58,138,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.7)',
      glassBlur: '12px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'elegant-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(30,58,138,0.04)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'pill',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── India Heritage / Maharaja ─────────────────────────────────────────
  maharaja_heritage: {
    id: 'maharaja_heritage',
    name: 'Royal Maharaja Heritage',
    colors: {
      primary: '#4c0519',
      accent: '#be123c',
      background: '#ffffff',
      surface: '#fff1f2',
      surfaceAlt: '#ffe4e6',
      text: '#1c1917',
      textSecondary: '#78716c',
      textOnPrimary: '#fbbf24',
      textOnAccent: '#ffffff',
      border: '#fda4af',
      gradient: 'linear-gradient(135deg, #4c0519 0%, #be123c 50%, #d97706 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(76,5,25,0.65) 0%, rgba(0,0,0,0.2) 40%, rgba(76,5,25,0.9) 100%)',
      cardGlow: 'rgba(190,18,60,0.08)',
    },
    typography: {
      headline: '"Cinzel", serif',
      subhead: '"Cormorant Garamond", serif',
      body: '"Inter", sans-serif',
      accent: '"Cinzel", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.125rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.8125rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.625rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 8px 32px rgba(76,5,25,0.06)',
      cardHoverShadow: '0 16px 48px rgba(76,5,25,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(255,241,242,0.8)',
      glassBlur: '12px',
      borderRadius: '0.75rem',
      borderRadiusSmall: '0.375rem',
      borderRadiusLarge: '1.25rem',
      sectionDivider: 'ornamental',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(76,5,25,0.04)',
    },
    decorations: {
      iconStyle: 'sharp',
      badgeStyle: 'ribbon',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '900px',
    },
  },

  // ─── Nordic / Aurora ───────────────────────────────────────────────────
  nordic_aurora: {
    id: 'nordic_aurora',
    name: 'Nordic Fjord Aurora',
    colors: {
      primary: '#0f172a',
      accent: '#10b981',
      background: '#ffffff',
      surface: '#f1f5f9',
      surfaceAlt: '#e2e8f0',
      text: '#0f172a',
      textSecondary: '#64748b',
      textOnPrimary: '#10b981',
      textOnAccent: '#0f172a',
      border: '#cbd5e1',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #10b981 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.2) 40%, rgba(15,23,42,0.9) 100%)',
      cardGlow: 'rgba(16,185,129,0.08)',
    },
    typography: {
      headline: '"Space Grotesk", sans-serif',
      subhead: '"Inter", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Space Grotesk", sans-serif',
      sizes: {
        heroTitle: '4.5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.25rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '4rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 4px 24px rgba(15,23,42,0.06)',
      cardHoverShadow: '0 12px 40px rgba(15,23,42,0.12)',
      glassMorphism: true,
      glassBackground: 'rgba(255,255,255,0.7)',
      glassBlur: '14px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'gradient-fade',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(15,23,42,0.04)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'square',
      dayNumberStyle: 'minimal',
      sectionSpacing: '3.5rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Safari / Expedition ───────────────────────────────────────────────
  safari_expedition: {
    id: 'safari_expedition',
    name: 'Serengeti Expedition',
    colors: {
      primary: '#7c2d12',
      accent: '#d97706',
      background: '#ffffff',
      surface: '#fefce8',
      surfaceAlt: '#fef9c3',
      text: '#1c1917',
      textSecondary: '#78716c',
      textOnPrimary: '#ffffff',
      textOnAccent: '#1c1917',
      border: '#fde68a',
      gradient: 'linear-gradient(135deg, #7c2d12 0%, #d97706 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(124,45,18,0.6) 0%, rgba(0,0,0,0.15) 40%, rgba(124,45,18,0.85) 100%)',
      cardGlow: 'rgba(217,119,6,0.08)',
    },
    typography: {
      headline: '"Cinzel", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Cinzel", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.125rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 6px 28px rgba(124,45,18,0.06)',
      cardHoverShadow: '0 14px 44px rgba(124,45,18,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(254,252,232,0.8)',
      glassBlur: '12px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'double-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(124,45,18,0.04)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'pill',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Europe / Editorial Minimal ────────────────────────────────────────
  european_editorial: {
    id: 'european_editorial',
    name: 'European Editorial',
    colors: {
      primary: '#18181b',
      accent: '#e11d48',
      background: '#ffffff',
      surface: '#fafafa',
      surfaceAlt: '#f4f4f5',
      text: '#18181b',
      textSecondary: '#71717a',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#e4e4e7',
      gradient: 'linear-gradient(135deg, #18181b 0%, #e11d48 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(24,24,27,0.6) 0%, rgba(0,0,0,0.15) 40%, rgba(24,24,27,0.85) 100%)',
      cardGlow: 'rgba(225,29,72,0.06)',
    },
    typography: {
      headline: '"Cormorant Garamond", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Cormorant Garamond", serif',
      sizes: {
        heroTitle: '5.5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.75rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '6rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 600, subhead: 500, body: 400, accent: 600 },
    },
    effects: {
      cardShadow: '0 2px 12px rgba(0,0,0,0.04)',
      cardHoverShadow: '0 8px 28px rgba(0,0,0,0.08)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.8)',
      glassBlur: '12px',
      borderRadius: '0.5rem',
      borderRadiusSmall: '0.25rem',
      borderRadiusLarge: '1rem',
      sectionDivider: 'elegant-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(0,0,0,0.02)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'square',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3.5rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Corporate / Executive ─────────────────────────────────────────────
  cosmopolitan_exec: {
    id: 'cosmopolitan_exec',
    name: 'Cosmopolitan Executive',
    colors: {
      primary: '#18181b',
      accent: '#06b6d4',
      background: '#ffffff',
      surface: '#f8fafc',
      surfaceAlt: '#f1f5f9',
      text: '#18181b',
      textSecondary: '#64748b',
      textOnPrimary: '#06b6d4',
      textOnAccent: '#18181b',
      border: '#e2e8f0',
      gradient: 'linear-gradient(135deg, #18181b 0%, #06b6d4 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(24,24,27,0.75) 0%, rgba(24,24,27,0.3) 40%, rgba(24,24,27,0.9) 100%)',
      cardGlow: 'rgba(6,182,212,0.06)',
    },
    typography: {
      headline: '"Space Grotesk", sans-serif',
      subhead: '"Inter", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Space Grotesk", sans-serif',
      sizes: {
        heroTitle: '4rem', heroSubtitle: '1.125rem',
        sectionTitle: '2rem', sectionSubtitle: '0.8125rem',
        cardTitle: '1.125rem', cardBody: '0.875rem',
        dayNumber: '3.5rem', dayTitle: '1.5rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 2px 12px rgba(0,0,0,0.04)',
      cardHoverShadow: '0 8px 28px rgba(0,0,0,0.08)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.85)',
      glassBlur: '12px',
      borderRadius: '0.5rem',
      borderRadiusSmall: '0.25rem',
      borderRadiusLarge: '0.75rem',
      sectionDivider: 'none',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(0,0,0,0.02)',
    },
    decorations: {
      iconStyle: 'sharp',
      badgeStyle: 'square',
      dayNumberStyle: 'minimal',
      sectionSpacing: '2.5rem',
      pageSpacing: '3rem',
      heroMinHeight: '750px',
    },
  },

  // ─── Honeymoon / Romantic ──────────────────────────────────────────────
  romantic_suite: {
    id: 'romantic_suite',
    name: 'Romantic Honeymoon Suite',
    colors: {
      primary: '#1c1917',
      accent: '#d4af37',
      background: '#0a0a0a',
      surface: '#171717',
      surfaceAlt: '#1c1c1c',
      text: '#fafaf9',
      textSecondary: '#a8a29e',
      textOnPrimary: '#d4af37',
      textOnAccent: '#1c1917',
      border: '#292524',
      gradient: 'linear-gradient(135deg, #1c1917 0%, #d4af37 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 100%)',
      cardGlow: 'rgba(212,175,55,0.08)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Cormorant Garamond", serif',
      body: '"Inter", sans-serif',
      accent: '"Playfair Display", serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.625rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 300, accent: 700 },
    },
    effects: {
      cardShadow: '0 8px 32px rgba(0,0,0,0.3)',
      cardHoverShadow: '0 16px 48px rgba(212,175,55,0.15)',
      glassMorphism: true,
      glassBackground: 'rgba(28,25,23,0.6)',
      glassBlur: '20px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'elegant-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(212,175,55,0.05)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'pill',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '900px',
    },
  },

  // ─── Family / Warm ─────────────────────────────────────────────────────
  family_warmth: {
    id: 'family_warmth',
    name: 'Family Retreat',
    colors: {
      primary: '#4a3f35',
      accent: '#f59e0b',
      background: '#fffdf7',
      surface: '#fef9f0',
      surfaceAlt: '#fdf6e3',
      text: '#4a3f35',
      textSecondary: '#92856b',
      textOnPrimary: '#f59e0b',
      textOnAccent: '#4a3f35',
      border: '#e8dcc8',
      gradient: 'linear-gradient(135deg, #4a3f35 0%, #f59e0b 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(74,63,53,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(74,63,53,0.8) 100%)',
      cardGlow: 'rgba(245,158,11,0.08)',
    },
    typography: {
      headline: '"Outfit", sans-serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Outfit", sans-serif',
      sizes: {
        heroTitle: '4rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.25rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.125rem', cardBody: '0.875rem',
        dayNumber: '3.5rem', dayTitle: '1.5rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 4px 20px rgba(74,63,53,0.06)',
      cardHoverShadow: '0 12px 36px rgba(74,63,53,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(255,253,247,0.8)',
      glassBlur: '12px',
      borderRadius: '1.25rem',
      borderRadiusSmall: '0.75rem',
      borderRadiusLarge: '2rem',
      sectionDivider: 'wave',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(74,63,53,0.03)',
    },
    decorations: {
      iconStyle: 'rounded',
      badgeStyle: 'pill',
      dayNumberStyle: 'circle',
      sectionSpacing: '2.5rem',
      pageSpacing: '3.5rem',
      heroMinHeight: '800px',
    },
  },

  // ─── Adventure / Bold ──────────────────────────────────────────────────
  adventure_bold: {
    id: 'adventure_bold',
    name: 'Epic Adventure',
    colors: {
      primary: '#0f172a',
      accent: '#ea580c',
      background: '#ffffff',
      surface: '#f8fafc',
      surfaceAlt: '#f1f5f9',
      text: '#0f172a',
      textSecondary: '#64748b',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#e2e8f0',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #ea580c 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(0,0,0,0.15) 40%, rgba(15,23,42,0.85) 100%)',
      cardGlow: 'rgba(234,88,12,0.06)',
    },
    typography: {
      headline: '"Space Grotesk", sans-serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Space Grotesk", sans-serif',
      sizes: {
        heroTitle: '5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.5rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.25rem', cardBody: '0.875rem',
        dayNumber: '5rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 700 },
    },
    effects: {
      cardShadow: '0 6px 28px rgba(15,23,42,0.06)',
      cardHoverShadow: '0 14px 44px rgba(234,88,12,0.12)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.75)',
      glassBlur: '12px',
      borderRadius: '0.75rem',
      borderRadiusSmall: '0.375rem',
      borderRadiusLarge: '1.25rem',
      sectionDivider: 'gradient-fade',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(234,88,12,0.04)',
    },
    decorations: {
      iconStyle: 'sharp',
      badgeStyle: 'square',
      dayNumberStyle: 'large-serif',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Eco / Wellness ────────────────────────────────────────────────────
  eco_sanctuary: {
    id: 'eco_sanctuary',
    name: 'Rainforest Sanctuary',
    colors: {
      primary: '#1a3a2a',
      accent: '#4d7c5a',
      background: '#ffffff',
      surface: '#f5f7f2',
      surfaceAlt: '#eef1e8',
      text: '#1a3a2a',
      textSecondary: '#6b8c71',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#c5d4bd',
      gradient: 'linear-gradient(135deg, #1a3a2a 0%, #4d7c5a 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(26,58,42,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(26,58,42,0.8) 100%)',
      cardGlow: 'rgba(77,124,90,0.08)',
    },
    typography: {
      headline: '"Playfair Display", serif',
      subhead: '"Outfit", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Cormorant Garamond", serif',
      sizes: {
        heroTitle: '4.5rem', heroSubtitle: '1.25rem',
        sectionTitle: '2.25rem', sectionSubtitle: '0.875rem',
        cardTitle: '1.125rem', cardBody: '0.875rem',
        dayNumber: '4rem', dayTitle: '1.75rem',
        price: '1.5rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 500, body: 400, accent: 600 },
    },
    effects: {
      cardShadow: '0 4px 20px rgba(26,58,42,0.06)',
      cardHoverShadow: '0 12px 36px rgba(26,58,42,0.1)',
      glassMorphism: false,
      glassBackground: 'rgba(245,247,242,0.8)',
      glassBlur: '12px',
      borderRadius: '1rem',
      borderRadiusSmall: '0.5rem',
      borderRadiusLarge: '1.5rem',
      sectionDivider: 'elegant-line',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(26,58,42,0.03)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'pill',
      dayNumberStyle: 'minimal',
      sectionSpacing: '3rem',
      pageSpacing: '4rem',
      heroMinHeight: '850px',
    },
  },

  // ─── Minimal / Modern ─────────────────────────────────────────────────
  minimal_modern: {
    id: 'minimal_modern',
    name: 'Minimal Modern',
    colors: {
      primary: '#171717',
      accent: '#525252',
      background: '#ffffff',
      surface: '#fafafa',
      surfaceAlt: '#f5f5f5',
      text: '#171717',
      textSecondary: '#a3a3a3',
      textOnPrimary: '#ffffff',
      textOnAccent: '#ffffff',
      border: '#e5e5e5',
      gradient: 'linear-gradient(135deg, #171717 0%, #525252 100%)',
      heroOverlay: 'linear-gradient(180deg, rgba(23,23,23,0.6) 0%, rgba(0,0,0,0.15) 40%, rgba(23,23,23,0.85) 100%)',
      cardGlow: 'rgba(0,0,0,0.04)',
    },
    typography: {
      headline: '"Inter", sans-serif',
      subhead: '"Inter", sans-serif',
      body: '"Inter", sans-serif',
      accent: '"Inter", sans-serif',
      sizes: {
        heroTitle: '4rem', heroSubtitle: '1rem',
        sectionTitle: '2rem', sectionSubtitle: '0.8125rem',
        cardTitle: '1rem', cardBody: '0.875rem',
        dayNumber: '3rem', dayTitle: '1.5rem',
        price: '1.375rem', badge: '0.6875rem',
      },
      weights: { headline: 700, subhead: 600, body: 400, accent: 600 },
    },
    effects: {
      cardShadow: '0 1px 3px rgba(0,0,0,0.04)',
      cardHoverShadow: '0 4px 12px rgba(0,0,0,0.08)',
      glassMorphism: false,
      glassBackground: 'rgba(255,255,255,0.9)',
      glassBlur: '8px',
      borderRadius: '0.25rem',
      borderRadiusSmall: '0.125rem',
      borderRadiusLarge: '0.5rem',
      sectionDivider: 'none',
      backgroundTexture: 'none',
      imageOverlay: 'rgba(0,0,0,0.02)',
    },
    decorations: {
      iconStyle: 'outlined',
      badgeStyle: 'square',
      dayNumberStyle: 'minimal',
      sectionSpacing: '2rem',
      pageSpacing: '3rem',
      heroMinHeight: '700px',
    },
  },
};


// ── Destination → Theme Mapping ──────────────────────────────────────────────
// Maps destination keywords to theme preset IDs for auto-resolution.

const DESTINATION_THEME_MAP = {
  // Japan
  japan: 'zen_heritage', kyoto: 'zen_heritage', tokyo: 'zen_heritage', osaka: 'zen_heritage',
  // Maldives / Tropical Islands
  maldives: 'tropical_paradise', seychelles: 'tropical_paradise', 'bora bora': 'tropical_paradise',
  fiji: 'tropical_paradise', mauritius: 'tropical_paradise',
  // Switzerland / Alps
  switzerland: 'alpine_frost', alps: 'alpine_frost', ski: 'alpine_frost', chamonix: 'alpine_frost',
  zermatt: 'alpine_frost', interlaken: 'alpine_frost',
  // Dubai / Middle East
  dubai: 'desert_opulence', 'abu dhabi': 'desert_opulence', qatar: 'desert_opulence',
  oman: 'desert_opulence', 'saudi arabia': 'desert_opulence', morocco: 'desert_opulence',
  // Bali / Southeast Asia
  bali: 'tropical_lush', thailand: 'tropical_lush', vietnam: 'tropical_lush',
  cambodia: 'tropical_lush', 'sri lanka': 'tropical_lush', kerala: 'tropical_lush',
  // Greece / Mediterranean
  greece: 'aegean_coast', santorini: 'aegean_coast', mykonos: 'aegean_coast',
  mediterranean: 'aegean_coast', croatia: 'aegean_coast', italy: 'aegean_coast',
  amalfi: 'aegean_coast', sicily: 'aegean_coast', turkey: 'aegean_coast',
  // India Heritage
  india: 'maharaja_heritage', rajasthan: 'maharaja_heritage', jaipur: 'maharaja_heritage',
  udaipur: 'maharaja_heritage', varanasi: 'maharaja_heritage', agra: 'maharaja_heritage',
  // Nordic
  norway: 'nordic_aurora', iceland: 'nordic_aurora', finland: 'nordic_aurora',
  sweden: 'nordic_aurora', lapland: 'nordic_aurora',
  // Safari / Africa
  safari: 'safari_expedition', serengeti: 'safari_expedition', kenya: 'safari_expedition',
  tanzania: 'safari_expedition', 'south africa': 'safari_expedition', botswana: 'safari_expedition',
  namibia: 'safari_expedition', rwanda: 'safari_expedition', uganda: 'safari_expedition',
  // Europe
  paris: 'european_editorial', london: 'european_editorial', rome: 'european_editorial',
  barcelona: 'european_editorial', amsterdam: 'european_editorial', vienna: 'european_editorial',
  prague: 'european_editorial', lisbon: 'european_editorial', berlin: 'european_editorial',
  europe: 'european_editorial', spain: 'european_editorial', france: 'european_editorial',
  portugal: 'european_editorial', germany: 'european_editorial',
  // Corporate
  'new york': 'cosmopolitan_exec', singapore: 'cosmopolitan_exec', 'hong kong': 'cosmopolitan_exec',
  // Eco / Wellness
  'costa rica': 'eco_sanctuary', peru: 'eco_sanctuary', galapagos: 'eco_sanctuary',
  amazon: 'eco_sanctuary', borneo: 'eco_sanctuary',
};

const TOUR_TYPE_THEME_MAP = {
  honeymoon: 'romantic_suite',
  romantic: 'romantic_suite',
  wedding: 'romantic_suite',
  anniversary: 'romantic_suite',
  family: 'family_warmth',
  group: 'family_warmth',
  kids: 'family_warmth',
  adventure: 'adventure_bold',
  trekking: 'adventure_bold',
  hiking: 'adventure_bold',
  diving: 'adventure_bold',
  corporate: 'cosmopolitan_exec',
  business: 'cosmopolitan_exec',
  conference: 'cosmopolitan_exec',
  mice: 'cosmopolitan_exec',
  wellness: 'eco_sanctuary',
  spa: 'eco_sanctuary',
  yoga: 'eco_sanctuary',
  retreat: 'eco_sanctuary',
  safari: 'safari_expedition',
  wildlife: 'safari_expedition',
  luxury: 'desert_opulence',
  cultural: 'zen_heritage',
  heritage: 'maharaja_heritage',
  cruise: 'tropical_paradise',
};


// ── Theme Resolver ───────────────────────────────────────────────────────────

/**
 * Resolves the best theme preset based on destination, tour type, and optional overrides.
 * Priority: explicit themeId > destination match > tour type match > fallback.
 *
 * @param {Object} opts
 * @param {string} [opts.themeId] — Explicit theme ID (highest priority)
 * @param {string} [opts.destination] — Destination string to match
 * @param {string} [opts.tourType] — Tour type to match
 * @param {Object} [opts.overrides] — Partial theme overrides (colors, typography, etc.)
 * @returns {Object} Fully resolved theme object
 */
export function resolveTheme({ themeId, destination, tourType, overrides } = {}) {
  let theme = null;

  // 1. Explicit theme ID
  if (themeId && THEME_PRESETS[themeId]) {
    theme = deepClone(THEME_PRESETS[themeId]);
  }

  // 2. Destination match
  if (!theme && destination) {
    const destLower = destination.toLowerCase().trim();
    for (const [keyword, presetId] of Object.entries(DESTINATION_THEME_MAP)) {
      if (destLower.includes(keyword)) {
        theme = deepClone(THEME_PRESETS[presetId]);
        break;
      }
    }
  }

  // 3. Tour type match
  if (!theme && tourType) {
    const typeLower = tourType.toLowerCase().trim();
    for (const [keyword, presetId] of Object.entries(TOUR_TYPE_THEME_MAP)) {
      if (typeLower.includes(keyword)) {
        theme = deepClone(THEME_PRESETS[presetId]);
        break;
      }
    }
  }

  // 4. Fallback
  if (!theme) {
    theme = deepClone(THEME_PRESETS.european_editorial);
  }

  // 5. Apply agency branding overrides
  if (overrides) {
    if (overrides.colors) theme.colors = { ...theme.colors, ...overrides.colors };
    if (overrides.typography) theme.typography = { ...theme.typography, ...overrides.typography };
    if (overrides.effects) theme.effects = { ...theme.effects, ...overrides.effects };
    if (overrides.decorations) theme.decorations = { ...theme.decorations, ...overrides.decorations };
  }

  return theme;
}

/**
 * Applies agency branding (from proposal.preferences.branding) on top of a theme.
 * This lets agency-level color/font choices override the theme defaults.
 */
export function applyBranding(theme, branding = {}) {
  const t = deepClone(theme);
  if (branding.primary_color) t.colors.primary = branding.primary_color;
  if (branding.secondary_color) t.colors.accent = branding.secondary_color;
  if (branding.bg_color) t.colors.background = branding.bg_color;
  if (branding.font_family) {
    t.typography.body = branding.font_family;
  }
  return t;
}

/**
 * Returns the flat legacy THEMES-compatible object for backward compatibility.
 */
export function toLegacyTheme(theme) {
  return {
    bg: theme.colors.background,
    text: theme.colors.text,
    accent: theme.colors.accent,
    alt: theme.colors.surfaceAlt,
  };
}

/**
 * Returns all available theme preset IDs and names for UI selectors.
 */
export function getThemeList() {
  return Object.values(THEME_PRESETS).map(t => ({
    id: t.id,
    name: t.name,
  }));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
