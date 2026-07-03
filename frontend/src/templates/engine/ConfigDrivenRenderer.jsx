import React, { memo, useMemo } from 'react';
import { TEMPLATE_CONFIGS } from './templateConfig.js';
import { resolveTheme } from './themeEngine.js';
import { resolveLayout } from './layoutEngine.js';
import * as Sections from '../components/sections/index.js';
import UniversalTemplateExtras from '../../components/common/UniversalTemplateExtras.jsx';
import './engine.css';

/**
 * Universal Config-Driven Renderer for Voyanta.
 * Interprets JSON template configurations to dynamically assemble theme tokens,
 * layout hierarchies, section variants, and day layout sequences.
 */
const ConfigDrivenRenderer = memo(function ConfigDrivenRenderer(props) {
  const { 
    style = 'luxury-01', 
    data, 
    proposal: proposalProp, 
    include = { hero: true, highlights: true, itinerary: true, hotels: true, costing: true, inclusions: true, exclusions: true, terms: true, contacts: true, socials: true }, 
    order = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'],
    branding: brandingProp,
    viewMode = 'document',
    activeSlide = 0
  } = props;

  // 1. Extract proposal data and items
  const proposal = proposalProp || data?.proposal || {};
  const branding = brandingProp || proposal.preferences?.branding || proposal.branding || {};
  const mergedProposal = { ...proposal, preferences: { ...proposal.preferences, branding } };

  // Flatten items from items_by_kind or items array
  const itemsByKind = data?.items_by_kind || props.items_by_kind || {};
  const allItems = useMemo(() => {
    if (Array.isArray(proposal.items) && proposal.items.length > 0) return proposal.items;
    if (Object.keys(itemsByKind).length > 0) {
      const list = [];
      for (const [kind, arr] of Object.entries(itemsByKind)) {
        if (Array.isArray(arr)) {
          for (const item of arr) {
            list.push({ ...item, kind: item.kind || kind });
          }
        }
      }
      return list;
    }
    return [];
  }, [proposal.items, itemsByKind]);

  const currency = data?.totals?.currency || proposal.currency || 'INR';

  // 2. Resolve Template Config
  const config = useMemo(() => {
    let found = TEMPLATE_CONFIGS[style];
    if (!found && style) {
      const normalized = style.replace(/-/g, '_');
      found = TEMPLATE_CONFIGS[normalized];
      if (!found) {
        const hyphenated = style.replace(/_/g, '-');
        found = TEMPLATE_CONFIGS[hyphenated];
      }
    }
    return found || TEMPLATE_CONFIGS['luxury_vogue'] || Object.values(TEMPLATE_CONFIGS)[0] || {
      id: style || 'custom-luxury',
      name: 'Custom Luxury Template',
      category: 'luxury',
      theme: 'desert_opulence',
      hero: { variant: 'full-bleed-cinematic' },
      highlights: { variant: 'editorial-two-column' },
      hotels: { variant: 'luxury-card-stack' },
      costing: { variant: 'luxury-invoice' },
      inclusions: { variant: 'card-pair' },
      terms: { variant: 'minimal-footer' },
      cta: { variant: 'luxury-cta' },
      itinerary: { dayLayoutPreset: 'editorial' }
    };
  }, [style]);

  // 3. Resolve Theme Tokens
  const theme = useMemo(() => {
    return resolveTheme({
      themeId: config.theme || config.themeId || 'desert_opulence',
      destination: mergedProposal.destination,
      tourType: mergedProposal.preferences?.tour_type || mergedProposal.tour_type,
      overrides: config.themeOverrides
    });
  }, [config, mergedProposal.destination, mergedProposal.preferences?.tour_type, mergedProposal.tour_type]);

  // 4. Resolve Layout Hierarchy & Variants
  const days = mergedProposal.itinerary?.days || mergedProposal.days || [];
  const dayCount = Array.isArray(days) && days.length > 0 ? days.length : (allItems.filter(i => (i.kind || '').toLowerCase() === 'day' || i.day || i.day_number).length || 5);

  const layout = useMemo(() => {
    return resolveLayout(config, dayCount);
  }, [config, dayCount]);

  // Generate CSS custom properties for inline binding
  const rootStyle = useMemo(() => {
    const colors = theme.colors || {};
    const typography = theme.typography || {};
    const effects = theme.effects || {};
    const decorations = theme.decorations || {};

    return {
      '--engine-primary': colors.primary || '#1a1a2e',
      '--engine-accent': colors.accent || '#c41e3a',
      '--engine-surface': colors.surface || '#ffffff',
      '--engine-surface-alt': colors.surfaceAlt || '#f8fafc',
      '--engine-text': colors.text || '#1a1a1a',
      '--engine-text-secondary': colors.textSecondary || '#64748b',
      '--engine-border': colors.border || '#e2e8f0',
      '--engine-font-headline': typography.headline || '"Playfair Display", serif',
      '--engine-font-subhead': typography.subhead || '"Cormorant Garamond", serif',
      '--engine-font-body': typography.body || '"Inter", sans-serif',
      '--engine-glass-bg': effects.glassBackground || 'rgba(255, 255, 255, 0.75)',
      '--engine-glass-blur': effects.glassBlur || '12px',
      '--engine-radius': effects.borderRadius || '1rem',
      backgroundColor: colors.background || '#ffffff',
      color: colors.text || '#1a1a1a',
      fontFamily: typography.body || '"Inter", sans-serif',
    };
  }, [theme]);

  // Section Dispatcher
  const renderSection = (key) => {
    if (!include[key]) return null;

    const variant = (layout && (layout.sectionVariants?.[key] || layout.sections?.[key])) || 'default';

    switch (key) {
      case 'hero':
        return <Sections.HeroBanner key="hero" proposal={mergedProposal} theme={theme} variant={variant} items={allItems} />;
      case 'highlights':
        return <Sections.HighlightsSection key="highlights" proposal={mergedProposal} theme={theme} variant={variant} />;
      case 'itinerary':
        return <Sections.ItinerarySection key="itinerary" proposal={mergedProposal} items={allItems} theme={theme} layoutConfig={layout} currency={currency} />;
      case 'hotels':
        return <Sections.AccommodationSection key="hotels" items={allItems} theme={theme} variant={variant} currency={currency} />;
      case 'costing':
        return <Sections.CostingSection key="costing" items={allItems} proposal={mergedProposal} theme={theme} variant={variant} currency={currency} />;
      case 'inclusions':
      case 'exclusions':
        return <Sections.InclusionsSection key="inclusions" proposal={mergedProposal} theme={theme} variant={variant} />;
      case 'terms':
        return <Sections.TermsSection key="terms" proposal={mergedProposal} theme={theme} variant={variant} />;
      case 'contacts':
      case 'socials':
      case 'cta':
        return <Sections.CTASection key="cta" proposal={mergedProposal} theme={theme} variant={variant} />;
      default: {
        const cb = (props.customBlocks || []).find(c => c.id === key);
        if (cb && include[key] !== false) {
          const contentVal = cb.content || '';
          const primaryColor = theme.colors?.primary || '#1a1a2e';
          const textSec = theme.colors?.textSecondary || '#64748b';
          const accentColor = theme.colors?.accent || '#c41e3a';
          return (
            <section key={key} className="py-12 px-8 md:px-16 max-w-7xl mx-auto editorial-section break-inside-avoid my-6 border-t border-outline-variant/30">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 border-b pb-3" style={{ color: primaryColor, fontFamily: theme.typography?.headline || 'serif', borderColor: accentColor }}>
                {cb.label}
              </h2>
              {cb.type === 'text' ? (
                <div className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: textSec, fontFamily: theme.typography?.body || 'sans-serif' }}>
                  {contentVal || '—'}
                </div>
              ) : cb.type === 'list' || cb.type === 'checklist' ? (
                <ul className="space-y-3 mt-4" style={{ color: textSec, fontFamily: theme.typography?.body || 'sans-serif' }}>
                  {(Array.isArray(contentVal) ? contentVal : contentVal.split('\n')).map((item, i) => item.trim() && (
                    <li key={i} className="flex items-start gap-3 text-base">
                      <span className="material-symbols-outlined text-sm mt-1 flex-shrink-0" style={{ color: accentColor }}>check_circle</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : cb.type === 'image' ? (
                contentVal ? (
                  <div className="mt-4 rounded-2xl overflow-hidden shadow-xl border border-outline-variant/50">
                    <img src={contentVal} className="w-full max-h-[600px] object-cover break-inside-avoid" alt={cb.label} />
                  </div>
                ) : null
              ) : (
                <div className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: textSec, fontFamily: theme.typography?.body || 'sans-serif' }}>
                  {contentVal || '—'}
                </div>
              )}
            </section>
          );
        }
        return null;
      }
    }
  };

  // Determine section execution order (respecting user ExportOptionsBar order if customized)
  const activeOrder = useMemo(() => {
    // Merge layout sectionOrder with order prop and custom blocks
    const baseOrder = [...(layout.sectionOrder && layout.sectionOrder.length > 0 ? layout.sectionOrder : order)];
    (order || []).forEach(k => {
      if (!baseOrder.includes(k)) baseOrder.push(k);
    });
    (props.customBlocks || []).forEach(cb => {
      if (!baseOrder.includes(cb.id)) baseOrder.push(cb.id);
    });
    // Deduplicate and filter by inclusion
    const seen = new Set();
    return baseOrder.filter(key => {
      // Treat inclusions and exclusions as one section block if both present
      const normalizedKey = key === 'exclusions' ? 'inclusions' : (key === 'contacts' || key === 'socials' ? 'cta' : key);
      if (seen.has(normalizedKey)) return false;
      seen.add(normalizedKey);
      return include[key] !== false;
    });
  }, [layout.sectionOrder, order, include, props.customBlocks]);

  return (
    <div className="voyanta-engine-root min-h-screen w-full transition-colors duration-500" style={rootStyle} data-template-id={style} data-theme-id={config.themeId}>
      {activeOrder.map((key) => renderSection(key))}
      <UniversalTemplateExtras 
        proposal={mergedProposal} 
        branding={branding} 
        customBlocks={props.customBlocks} 
        order={activeOrder} 
        style={style} 
        theme={theme} 
        renderedKeys={activeOrder} 
      />
    </div>
  );
});

export default ConfigDrivenRenderer;
