import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { demoStore } from './demoStore.js';

const TABLE = 'proposals';
const isDemo = () => typeof window !== 'undefined' && localStorage.getItem('voyanta_demo_session') === '1';

export async function fetchProposals() {
  if (isDemo()) return demoStore.list();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function fetchProposalById(id) {
  if (isDemo()) return demoStore.get(id);
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw error;
  return normalize(data);
}

export async function createProposal(payload) {
  if (isDemo()) return demoStore.insert(payload);
  if (!supabase) throw new Error('Supabase not configured');
  const row = {
    agency_id: DEFAULT_AGENCY_ID,
    name: payload.name,
    client_name: payload.client_name,
    destination: payload.destination,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    travelers: payload.travelers ?? null,
    budget_min: payload.budget_min ?? null,
    budget_max: payload.budget_max ?? null,
    currency: payload.currency || 'USD',
    preferences: payload.preferences || null,
    trip_details: payload.trip_details || null,
    brief: payload.brief || null,
    status: payload.status || 'Draft',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return normalize(data);
}

export async function updateProposal(id, patch) {
  if (isDemo()) return demoStore.update(id, patch);
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteProposal(id) {
  if (isDemo()) { demoStore.remove(id); return; }
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateProposal(id) {
  if (isDemo()) return demoStore.duplicate(id);
  const src = await fetchProposalById(id);
  if (!src) return null;
  // eslint-disable-next-line no-unused-vars
  const { id: _, created_at, updated_at, ...rest } = src;
  return createProposal({ ...rest, name: (src.name || 'Proposal') + ' (Copy)', status: 'Draft' });
}

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    date: row.date || (row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''),
  };
}
