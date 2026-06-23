import { getSupabase } from '../lib/supabaseClient.js';
import { proposals as mockProposals } from '../data/proposals.js';

export async function fetchProposals() {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.from('proposals').select('*').order('date', { ascending: false });
    return data ?? [];
  }
  return mockProposals;
}

export async function fetchProposalById(id) {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.from('proposals').select('*').eq('id', id).single();
    return data;
  }
  return mockProposals.find((p) => p.id === id) ?? null;
}
