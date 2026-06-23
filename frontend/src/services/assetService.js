import { getSupabase } from '../lib/supabaseClient.js';
import { assets as mockAssets } from '../data/assets.js';

export async function fetchAssets(filters = {}) {
  const sb = await getSupabase();
  if (sb) {
    let q = sb.from('assets').select('*');
    if (filters.type) q = q.eq('type', filters.type);
    const { data } = await q;
    return data ?? [];
  }
  return mockAssets.filter((a) => !filters.type || a.type === filters.type);
}
