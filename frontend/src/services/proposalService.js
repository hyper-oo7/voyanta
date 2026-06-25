// Production-mode proposalService: always reads/writes Supabase (now that the
// schema has been deployed). Demo session no longer redirects to localStorage —
// it just bypasses the auth gate so testers can play without a real account.
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

const TABLE = 'proposals';

export async function fetchProposals() {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('agency_id', DEFAULT_AGENCY_ID).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

export async function fetchProposalById(id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function createProposal(payload) {
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
    currency: payload.currency || 'INR',
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
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteProposal(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateProposal(id) {
  const src = await fetchProposalById(id);
  if (!src) return null;
  // eslint-disable-next-line no-unused-vars
  const { id: _, created_at, updated_at, date, ...rest } = src;
  return createProposal({ ...rest, name: (src.name || 'Proposal') + ' (Copy)', status: 'Draft' });
}

function normalize(row) {
  return {
    ...row,
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  };
}
