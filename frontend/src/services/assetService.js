import { supabase } from '../lib/supabaseClient.js';
import { assets as mockAssets } from '../data/assets.js';

const isDemo = () => typeof window !== 'undefined' && localStorage.getItem('voyanta_demo_session') === '1';

export async function fetchAssets(filters = {}) {
  if (isDemo() || !supabase) return mockAssets.filter((a) => !filters.type || a.type === filters.type);
  let q = supabase.from('activities').select('*');
  if (filters.type) q = q.eq('type', filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return data?.length ? data : mockAssets;
}
