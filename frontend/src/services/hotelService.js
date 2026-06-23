// Now points exclusively at the real Supabase tables. The localStorage demo
// store is retained only for the proposals/dashboard UX (proposalService.js)
// because that's where the demo session feeds into.
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { hotels as mockHotels } from '../data/hotels.js';

export async function fetchHotels(filters = {}) {
  if (!supabase) return mockHotels; // last-resort fallback if env unset
  let q = supabase.from('hotels').select('*').eq('agency_id', DEFAULT_AGENCY_ID);
  if (filters.country) q = q.eq('country', filters.country);
  if (filters.category) q = q.eq('category', filters.category);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
