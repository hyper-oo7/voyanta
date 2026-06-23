import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { assets as mockAssets } from '../data/assets.js';

export async function fetchAssets(filters = {}) {
  if (!supabase) return mockAssets;
  let q = supabase.from('activities').select('*').eq('agency_id', DEFAULT_AGENCY_ID);
  if (filters.type) q = q.eq('type', filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
