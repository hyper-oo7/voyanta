import { supabase } from '../lib/supabaseClient.js';
import { hotels as mockHotels } from '../data/hotels.js';

const isDemo = () => typeof window !== 'undefined' && localStorage.getItem('voyanta_demo_session') === '1';

export async function fetchHotels(filters = {}) {
  if (isDemo() || !supabase) {
    return mockHotels.filter((h) =>
      (!filters.country || h.country === filters.country) &&
      (!filters.category || h.category === filters.category)
    );
  }
  let q = supabase.from('hotels').select('*');
  if (filters.country) q = q.eq('country', filters.country);
  if (filters.category) q = q.eq('category', filters.category);
  const { data, error } = await q;
  if (error) throw error;
  return data?.length ? data : mockHotels;
}
