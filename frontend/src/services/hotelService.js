import { getSupabase } from '../lib/supabaseClient.js';
import { hotels as mockHotels } from '../data/hotels.js';

export async function fetchHotels(filters = {}) {
  const sb = await getSupabase();
  if (sb) {
    let q = sb.from('hotels').select('*');
    if (filters.country) q = q.eq('country', filters.country);
    if (filters.category) q = q.eq('category', filters.category);
    const { data } = await q;
    return data ?? [];
  }
  return mockHotels.filter((h) =>
    (!filters.country || h.country === filters.country) &&
    (!filters.category || h.category === filters.category)
  );
}
