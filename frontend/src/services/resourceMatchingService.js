import { supabase, getAgencyId } from '../lib/supabaseClient.js';

/* ── Helpers ─────────────────────────────────────────────────────── */

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function stringScore(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  // Simple word overlap
  const wa = new Set(na.split(/\d+/).filter(Boolean));
  const wb = new Set(nb.split(/\d+/).filter(Boolean));
  const inter = [...wa].filter((x) => wb.has(x)).length;
  const union = new Set([...wa, ...wb]).size;
  return union ? Math.round((inter / union) * 60) : 0;
}

function priceScore(resourcePrice, targetBudget) {
  if (!targetBudget || !resourcePrice) return 50;
  const diff = Math.abs(resourcePrice - targetBudget) / targetBudget;
  if (diff <= 0.1) return 100;
  if (diff <= 0.25) return 80;
  if (diff <= 0.5) return 60;
  if (diff <= 1.0) return 40;
  return 20;
}

/* ── Base vault query (from Priority 2, enhanced) ───────────────── */

export async function matchVaultResources({
  destination,
  budgetPerHead,
  travelers,
  durationDays,
  travelStyle,
}) {
  const agencyId = getAgencyId();
  const results = { hotels: [], activities: [], flights: [], templates: [] };
  if (!destination) return results;

  const destPattern = `%${destination}%`;

  // Hotels
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('agency_id', agencyId)
      .or(`location.ilike.${destPattern},country.ilike.${destPattern},name.ilike.${destPattern}`)
      .limit(50);

    if (!error && data) {
      results.hotels = data
        .map((h) => ({
          ...h,
          _matchScore: Math.round(
            (stringScore(h.location, destination) * 0.4) +
            (stringScore(h.country, destination) * 0.2) +
            (priceScore(h.price_per_night, budgetPerHead ? budgetPerHead / (durationDays || 1) : null) * 0.3) +
            ((h.rating || 0) * 10) // small rating boost
          ),
        }))
        .filter((h) => {
          if (!budgetPerHead || !h.price_per_night) return true;
          const dailyBudget = budgetPerHead / (durationDays || 1);
          return h.price_per_night <= dailyBudget * 1.8; // allow slight overshoot
        })
        .sort((a, b) => b._matchScore - a._matchScore)
        .slice(0, 12);
    }
  } catch (e) {
    console.warn('Hotel vault query failed:', e);
  }

  // Activities
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('agency_id', agencyId)
      .or(`location.ilike.${destPattern},name.ilike.${destPattern},type.ilike.%${travelStyle || ''}%`)
      .limit(50);

    if (!error && data) {
      results.activities = data
        .map((a) => ({
          ...a,
          _matchScore: Math.round(
            (stringScore(a.location, destination) * 0.5) +
            (priceScore(a.price, budgetPerHead ? budgetPerHead * 0.2 : null) * 0.3) +
            (stringScore(a.type, travelStyle) * 0.2)
          ),
        }))
        .filter((a) => {
          if (!budgetPerHead || !a.price) return true;
          return a.price <= budgetPerHead * 0.3;
        })
        .sort((a, b) => b._matchScore - a._matchScore)
        .slice(0, 15);
    }
  } catch (e) {
    console.warn('Activity vault query failed:', e);
  }

  // Flights
  try {
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .eq('agency_id', agencyId)
      .or(`destination.ilike.${destPattern},origin.ilike.${destPattern}`)
      .limit(20);

    if (!error && data) {
      results.flights = data
        .map((f) => ({
          ...f,
          _matchScore: Math.round(
            (stringScore(f.destination, destination) * 0.5) +
            (stringScore(f.origin, destination) * 0.3) +
            (priceScore(f.cost, budgetPerHead ? budgetPerHead * 0.4 : null) * 0.2)
          ),
        }))
        .sort((a, b) => b._matchScore - a._matchScore)
        .slice(0, 8);
    }
  } catch (e) {
    console.warn('Flight vault query failed:', e);
  }

  // Templates
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('agency_id', agencyId)
      .or(`destination.ilike.${destPattern},name.ilike.${destPattern}`)
      .limit(10);

    if (!error && data) {
      results.templates = data.slice(0, 5);
    }
  } catch (e) {
    console.warn('Template vault query failed:', e);
  }

  return results;
}

/* ── Day-slot suggestion engine ──────────────────────────────────── */

/**
 * Suggest resources for a specific day slot, excluding already-used IDs.
 * @param {object} params
 * @param {'hotel'|'activity'|'flight'} slotType
 * @param {number} dayNumber
 * @param {string} destination
 * @param {number|null} budgetPerHead
 * @param {number} travelers
 * @param {number} durationDays
 * @param {string} travelStyle
 * @param {Set<string>} usedIds — IDs already placed in the itinerary
 * @returns {Promise<Array>} ranked suggestions with matchScore
 */
export async function suggestForDaySlot({
  slotType,
  dayNumber,
  destination,
  budgetPerHead,
  travelers,
  durationDays,
  travelStyle,
  usedIds = new Set(),
}) {
  const all = await matchVaultResources({
    destination,
    budgetPerHead,
    travelers,
    durationDays,
    travelStyle,
  });

  let pool = [];
  if (slotType === 'hotel') pool = all.hotels || [];
  if (slotType === 'activity') pool = all.activities || [];
  if (slotType === 'flight') pool = all.flights || [];

  // Exclude already-used IDs
  const filtered = pool.filter((item) => !usedIds.has(item.id));

  // Day-specific heuristics
  return filtered.map((item) => {
    let score = item._matchScore || 50;

    // Flight heuristics: arrival on day 1, departure on last day
    if (slotType === 'flight') {
      const isArrival = dayNumber === 1;
      const isDeparture = dayNumber === durationDays;
      const destMatch = stringScore(item.destination, destination);
      const originMatch = stringScore(item.origin, destination);

      if (isArrival && destMatch > 60) score += 20;
      if (isDeparture && originMatch > 60) score += 20;
      if (!isArrival && !isDeparture) score -= 30; // flights only on first/last day
    }

    // Hotel heuristics: prefer same hotel across consecutive days
    // (This is handled by the caller tracking last-used hotel)

    // Activity heuristics: spread high-energy activities across days
    if (slotType === 'activity' && item.duration_hours > 4) {
      score -= (dayNumber % 2 === 0 ? 5 : 0); // slight alternation bias
    }

    return { ...item, _suggestionScore: Math.min(100, Math.max(0, score)) };
  }).sort((a, b) => b._suggestionScore - a._suggestionScore);
}

/**
 * Build a Set of already-used resource IDs across all days.
 */
export function buildUsedIdSet(days = []) {
  const used = new Set();
  for (const d of days) {
    (d.hotels || []).forEach((h) => h.id && used.add(h.id));
    (d.activities || []).forEach((a) => a.id && used.add(a.id));
    (d.flights || []).forEach((f) => f.id && used.add(f.id));
  }
  return used;
}
