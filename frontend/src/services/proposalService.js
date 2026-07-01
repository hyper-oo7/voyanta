// Production-mode proposalService: always reads/writes Supabase (now that the
// schema has been deployed). Demo session no longer redirects to localStorage —
// it just bypasses the auth gate so testers can play without a real account.
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

const TABLE = 'proposals';
const CACHE_KEY = 'voyanta_proposals_list_cache';

// Lightweight projection: Exclude heavy JSONB columns (itinerary, trip_details, brief)
const LIST_COLUMNS = 'id, agency_id, created_by, client_id, name, client_name, status, destination, start_date, end_date, travelers, budget_min, budget_max, currency, total_cost, is_archived, arrival_city, arrival_airport, departure_city, departure_airport, created_at, updated_at, preferences';

export async function fetchProposals() {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
  }
  const { data, error } = await supabase.from(TABLE).select(LIST_COLUMNS)
    .eq('agency_id', DEFAULT_AGENCY_ID)
    .neq('is_archived', true)
    .order('created_at', { ascending: false });
  if (error) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) return cached;
    } catch {}
    throw error;
  }
  const result = (data || []).map(normalize);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
  return result;
}

export async function fetchProposalById(id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) {
    try {
      const cached = JSON.parse(localStorage.getItem(`voyanta_proposal_${id}`) || 'null');
      if (cached) return cached;
    } catch {}
    throw error;
  }
  if (data) {
    const norm = normalize(data);
    try { localStorage.setItem(`voyanta_proposal_${id}`, JSON.stringify(norm)); } catch {}
    return norm;
  }
  return null;
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
    arrival_city: payload.arrival_city || null,
    arrival_airport: payload.arrival_airport || null,
    departure_city: payload.departure_city || null,
    departure_airport: payload.departure_airport || null,
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
  const newProposal = await createProposal({ ...rest, name: (src.name || 'Proposal') + ' (Copy)', status: 'Draft' });
  
  // Duplicate items
  if (supabase) {
    const { data: items } = await supabase.from('proposal_items').select('*').eq('proposal_id', id);
    if (items && items.length > 0) {
      const newItems = items.map(item => {
        const { id: __, created_at: ___, proposal_id: ____, ...itemRest } = item;
        return { ...itemRest, proposal_id: newProposal.id };
      });
      await supabase.from('proposal_items').insert(newItems);
    }
  }
  return newProposal;
}

export async function archiveProposal(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from(TABLE).update({ is_archived: true }).eq('id', id).select().single();
  if (error) throw error;
  return normalize(data);
}

function normalize(row) {
  return {
    ...row,
    date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  };
}
