import { TEMPLATE_CONFIGS } from './templateConfig.js';
import { THEME_PRESETS } from './themeEngine.js';

/**
 * Intelligent Recommendation Engine for Voyanta.
 * Recommends the ideal magazine-quality templates based on destination,
 * tour type, party size, budget, and client preferences.
 */
export function recommendTemplates(proposal = {}, limit = 3) {
  const dest = (proposal.destination || '').toLowerCase();
  const tourType = (proposal.preferences?.tour_type || proposal.tour_type || '').toLowerCase();
  const travelers = Number(proposal.travelers || proposal.brief?.num_adults || 2);
  const budget = Number(proposal.total_amount || proposal.budget || 0);

  const scored = Object.entries(TEMPLATE_CONFIGS).map(([slug, config]) => {
    let score = 0;
    const reasons = [];

    // Category matching
    const cat = (config.category || '').toLowerCase();
    const tags = (config.tags || []).map(t => t.toLowerCase());

    // 1. Destination match
    if (dest) {
      if (dest.includes('japan') && (cat === 'cultural' || tags.includes('japan') || tags.includes('minimal'))) {
        score += 35;
        reasons.push('Ideal aesthetic for Japanese cultural immersion');
      } else if ((dest.includes('safari') || dest.includes('kenya') || dest.includes('tanzania') || dest.includes('africa')) && (cat === 'adventure' || tags.includes('safari') || tags.includes('wildlife'))) {
        score += 35;
        reasons.push('Tailored wildlife & Serengeti editorial layouts');
      } else if ((dest.includes('maldives') || dest.includes('bali') || dest.includes('fiji') || dest.includes('beach')) && (cat === 'honeymoon' || cat === 'tropical' || tags.includes('beach'))) {
        score += 35;
        reasons.push('Lagoon and resort-focused visual spreads');
      } else if ((dest.includes('swiss') || dest.includes('alps') || dest.includes('ski')) && (cat === 'luxury' || tags.includes('alpine') || tags.includes('ski'))) {
        score += 35;
        reasons.push('Crisp mountain chalet and winter sports styling');
      } else if ((dest.includes('dubai') || dest.includes('arab') || dest.includes('qatar')) && (cat === 'opulence' || tags.includes('desert') || tags.includes('middle-east'))) {
        score += 35;
        reasons.push('Royal Arabian opulence and desert mirage accents');
      } else if ((dest.includes('greece') || dest.includes('santorini') || dest.includes('mediterranean')) && (cat === 'luxury' || tags.includes('greece') || tags.includes('island'))) {
        score += 35;
        reasons.push('Aegean coastal blue and Mediterranean cards');
      }
    }

    // 2. Tour Type match
    if (tourType) {
      if (tourType.includes('honeymoon') || tourType.includes('romantic')) {
        if (cat === 'honeymoon' || tags.includes('honeymoon')) {
          score += 30;
          reasons.push('Designed specifically for romantic getaways');
        }
      } else if (tourType.includes('family') || travelers > 4) {
        if (cat === 'family' || cat === 'warm' || tags.includes('family')) {
          score += 30;
          reasons.push('Spacious multi-generational layouts & clear schedules');
        }
      } else if (tourType.includes('adventure') || tourType.includes('expedition') || tourType.includes('trek')) {
        if (cat === 'adventure' || tags.includes('adventure')) {
          score += 30;
          reasons.push('Dynamic expedition tracking & timeline layouts');
        }
      } else if (tourType.includes('corporate') || tourType.includes('executive') || tourType.includes('business')) {
        if (cat === 'corporate' || cat === 'executive' || tags.includes('corporate')) {
          score += 30;
          reasons.push('Sleek executive summary and structured tables');
        }
      } else if (tourType.includes('luxury') || budget > 500000) {
        if (cat === 'luxury' || cat === 'magazine' || tags.includes('luxury')) {
          score += 25;
          reasons.push('Premium coffee-table publication formatting');
        }
      }
    }

    // 3. High budget tier boost
    if (budget > 1000000 && (config.tier === 'Luxury' || config.tier === 'Magazine')) {
      score += 15;
      if (reasons.length === 0) reasons.push('Ultra-luxury magazine presentation for VIP budgets');
    }

    // Default baseline score for popular premium templates
    if (score === 0) {
      if (slug.includes('luxury-magazine-01') || slug.includes('minimal-modern-01')) {
        score = 20;
        reasons.push('Universal luxury editorial favorite');
      } else {
        score = 10;
        reasons.push('Clean and well-structured design');
      }
    }

    return {
      slug,
      ...config,
      matchScore: score,
      reasons,
    };
  });

  // Sort by score descending and return top matches
  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, limit);
}

/**
 * Generates a structured prompt suitable for Google Gemini API
 * to provide custom AI editorial reasoning and customization suggestions.
 */
export function getAIRecommendationPrompt(proposal = {}) {
  const dest = proposal.destination || 'Global';
  const tourType = proposal.preferences?.tour_type || proposal.tour_type || 'Bespoke Luxury';
  const clientName = proposal.client_name || proposal.brief?.client_name || 'VIP Client';
  const days = proposal.duration_days || proposal.days || 7;

  return `You are a Senior Luxury Travel Designer at Voyanta. Analyze this trip proposal and suggest why the selected magazine template is the perfect design match:
Client: ${clientName}
Destination: ${dest}
Duration: ${days} Days
Style: ${tourType}

Provide a 2-sentence executive summary highlighting why the typography, color palette, and visual pacing of this proposal will impress the client.`;
}
