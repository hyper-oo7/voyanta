// Production-mode proposalService: always reads/writes Supabase.
// Uses dynamic agency_id from auth store, sets created_by on creation.
import { supabase, getAgencyId } from '../lib/supabaseClient.js';
import { upsertClientFromProposal } from './crmService.js';

const TABLE = 'proposals';
const CACHE_KEY = 'voyanta_proposals_list_cache';
const PAGE_SIZE = 10;

function notifyDbError(resource, error) {
  console.error(`Supabase DB Error in ${resource}:`, error);
  window.dispatchEvent(
    new CustomEvent('voyanta:database-error', {
      detail: { resource, error: error?.message || String(error) },
    })
  );
}

// Lightweight projection: Exclude heavy JSONB columns (itinerary, trip_details, brief)
const LIST_COLUMNS = 'id, agency_id, created_by, client_id, name, client_name, status, destination, start_date, end_date, travelers, budget_min, budget_max, currency, total_cost, is_archived, arrival_city, arrival_airport, departure_city, departure_airport, created_at, updated_at, preferences';

export async function fetchProposals({ page = 0, pageSize = PAGE_SIZE } = {}) {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase.from(TABLE).select(LIST_COLUMNS, { count: 'exact' })
        .eq('agency_id', agencyId)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (!error && data) {
        const remoteList = data.map(normalize);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(remoteList)); } catch {}
        return { data: remoteList, count: count || remoteList.length, page, pageSize };
      }
    } catch (e) {
      console.warn('Supabase fetchProposals failed, checking cache:', e);
    }
  }
  
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  } catch {}
  localList = localList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return { data: localList, count: localList.length, page: 0, pageSize: localList.length };
}

// Legacy compat: return flat array for hooks that don't support pagination yet
export async function fetchProposalsFlat() {
  const result = await fetchProposals({ page: 0, pageSize: 500 });
  return result.data;
}

export async function fetchProposalById(id) {
  if (!id) return null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        const norm = normalize(data);
        try { localStorage.setItem(`voyanta_proposal_${id}`, JSON.stringify(norm)); } catch {}
        return norm;
      }
    } catch {}
  }
  try {
    const cached = JSON.parse(localStorage.getItem(`voyanta_proposal_${id}`) || 'null');
    if (cached) return cached;
  } catch {}
  return null;
}

export async function createProposal(payload) {
  const agencyId = getAgencyId();
  
  // Get current user for created_by
  let userId = null;
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {}
  }

  const row = {
    id: crypto.randomUUID(),
    agency_id: agencyId,
    created_by: userId,
    client_id: payload.client_id || null,
    name: payload.name || 'Untitled Proposal',
    client_name: payload.client_name || '',
    destination: payload.destination || '',
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase.from(TABLE).insert(row).select().single();
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
    if (data) {
      const norm = normalize(data);
      try { localStorage.setItem(`voyanta_proposal_${norm.id}`, JSON.stringify(norm)); } catch {}
      try { upsertClientFromProposal(norm).catch(() => {}); } catch {}
      return norm;
    }
  }

  const norm = normalize(row);
  try {
    localStorage.setItem(`voyanta_proposal_${norm.id}`, JSON.stringify(norm));
    const listStr = localStorage.getItem(CACHE_KEY) || '[]';
    const list = JSON.parse(listStr);
    list.unshift(norm);
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {}
  try { upsertClientFromProposal(norm).catch(() => {}); } catch {}
  window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
  return norm;
}


export async function updateProposal(id, patch) {
  if (supabase) {
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
    if (data) {
      const norm = normalize(data);
      try { localStorage.setItem(`voyanta_proposal_${id}`, JSON.stringify(norm)); } catch {}
      try { upsertClientFromProposal(norm).catch(() => {}); } catch {}
      window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
      return norm;
    }
  }

  // LocalStorage Fallback
  try {
    const existingStr = localStorage.getItem(`voyanta_proposal_${id}`);
    const existing = existingStr ? JSON.parse(existingStr) : { id, created_at: new Date().toISOString() };
    const updated = { ...existing, ...patch, id, updated_at: new Date().toISOString() };
    const norm = normalize(updated);
    localStorage.setItem(`voyanta_proposal_${id}`, JSON.stringify(norm));

    const listStr = localStorage.getItem(CACHE_KEY) || '[]';
    let list = JSON.parse(listStr);
    const idx = list.findIndex(item => item.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch, id, updated_at: norm.updated_at };
    } else {
      list.unshift(norm);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    try { upsertClientFromProposal(norm).catch(() => {}); } catch {}
    window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
    return norm;
  } catch {
    return normalize({ id, ...patch });
  }
}

export async function deleteProposal(id) {
  if (supabase) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
  }
  try {
    localStorage.removeItem(`voyanta_proposal_${id}`);
    const listStr = localStorage.getItem(CACHE_KEY) || '[]';
    const list = JSON.parse(listStr).filter(item => item.id !== id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export async function deleteAllProposals() {
  const agencyId = getAgencyId();
  if (supabase) {
    const { error: err1 } = await supabase.from('proposal_items').delete().neq('id', 0);
    if (err1) { notifyDbError('proposal_items', err1); throw err1; }
    const { error: err2 } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) { notifyDbError(TABLE, err2); throw err2; }
  }
  try {
    localStorage.removeItem(CACHE_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('voyanta_proposal_') || k === CACHE_KEY)) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

export async function duplicateProposal(id) {
  const src = await fetchProposalById(id);
  if (!src) return null;
  // eslint-disable-next-line no-unused-vars
  const { id: _, created_at, updated_at, date, created_by, ...rest } = src;
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

export async function resetAllDataToZero() {
  const agencyId = getAgencyId();
  try {
    // 1. Wipe local storage caches
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('voyanta_proposal_') || key === 'voyanta_proposals_list_cache')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 2. Wipe Supabase tables for this agency
    if (supabase) {
      await supabase.from('analytics_events').delete().eq('agency_id', agencyId);
      await supabase.from('activity_logs').delete().eq('agency_id', agencyId);
      await supabase.from('notifications').delete().eq('agency_id', agencyId);
      await supabase.from('proposal_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('proposals').delete().eq('agency_id', agencyId);
    }

    // 3. Notify real-time UI listeners
    window.dispatchEvent(new CustomEvent('voyanta:analytics-updated'));
    window.dispatchEvent(new CustomEvent('voyanta:notifications-updated'));
    window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
    console.log('All data reset to zero successfully.');
    return true;
  } catch (err) {
    console.error('Failed to reset data to zero:', err);
    return false;
  }
}
