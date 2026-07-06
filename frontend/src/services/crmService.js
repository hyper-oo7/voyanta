import { supabase, getAgencyId } from '../lib/supabaseClient.js';

const TABLE = 'clients';
const CACHE_KEY = 'voyanta_crm_clients';
const PAGE_SIZE = 10;

function notifyDbError(resource, error) {
  console.error(`Supabase DB Error in ${resource}:`, error);
  window.dispatchEvent(
    new CustomEvent('voyanta:database-error', {
      detail: { resource, error: error?.message || String(error) },
    })
  );
}

export const TRIP_STATUSES = [
  { id: 'Inquiry', label: 'Inquiry', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'Proposal Sent', label: 'Proposal Sent', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'Approved', label: 'Approved', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'Booked', label: 'Booked', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }
];

function getLocalClients() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalClients(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchClients({ page = 0, pageSize = PAGE_SIZE, status = null } = {}) {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      let query = supabase.from(TABLE).select('*', { count: 'exact' })
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query.range(from, to);
      if (!error && data) {
        saveLocalClients(data);
        return { data, count: count || data.length, page, pageSize };
      }
    } catch (e) {
      console.warn('Supabase fetchClients failed, falling back to localStorage:', e);
    }
  }

  let list = getLocalClients();
  if (status && status !== 'ALL') {
    list = list.filter(c => c.status === status);
  }
  list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const count = list.length;
  const sliced = list.slice(page * pageSize, (page + 1) * pageSize);
  return { data: sliced, count, page, pageSize };
}

export async function createClient(clientData) {
  const agencyId = getAgencyId();
  const now = new Date().toISOString();
  const newClient = {
    id: `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agency_id: agencyId,
    name: clientData.name || 'Unnamed Client',
    email: clientData.email || '',
    phone: clientData.phone || '',
    destination: clientData.destination || '',
    status: clientData.status || 'Inquiry',
    notes: clientData.notes || '',
    created_at: now,
    updated_at: now,
    ...clientData
  };

  if (supabase) {
    const { data, error } = await supabase.from(TABLE).insert([newClient]).select().single();
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
    if (data) {
      const list = getLocalClients();
      saveLocalClients([data, ...list]);
      try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
      return data;
    }
  }

  const list = getLocalClients();
  const updated = [newClient, ...list];
  saveLocalClients(updated);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
  return newClient;
}

export async function updateClient(id, patch) {
  const now = new Date().toISOString();
  const updatePayload = { ...patch, updated_at: now };

  if (supabase) {
    const { data, error } = await supabase.from(TABLE).update(updatePayload).eq('id', id).select().single();
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
    if (data) {
      const list = getLocalClients().map(c => c.id === id ? { ...c, ...data } : c);
      saveLocalClients(list);
      try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
      return data;
    }
  }

  const list = getLocalClients().map(c => c.id === id ? { ...c, ...updatePayload } : c);
  saveLocalClients(list);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
  const updated = list.find(c => c.id === id);
  return updated || null;
}

export async function deleteClient(id) {
  if (supabase) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      notifyDbError(TABLE, error);
      throw error;
    }
  }
  const list = getLocalClients().filter(c => c.id !== id);
  saveLocalClients(list);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
  return true;
}

export async function upsertClientFromProposal(proposal) {
  if (!proposal) return null;
  const name = proposal.client_name || proposal.customer_name || proposal.client || proposal.brief?.client_name || proposal.brief?.customer_name || 'Valued Client';
  const email = proposal.client_email || proposal.email || proposal.brief?.client_email || proposal.brief?.email || '';
  const phone = proposal.client_phone || proposal.phone || proposal.brief?.client_phone || proposal.brief?.phone || '';
  const destination = proposal.destination || proposal.brief?.destination || '';

  const list = getLocalClients();
  let existing = null;
  if (email) {
    existing = list.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
  }
  if (!existing && name && name !== 'Valued Client') {
    existing = list.find(c => c.name && c.name.toLowerCase() === name.toLowerCase());
  }

  if (existing) {
    return updateClient(existing.id, {
      status: 'Proposal Sent',
      destination: destination || existing.destination,
      phone: phone || existing.phone
    });
  } else {
    return createClient({
      name,
      email,
      phone,
      destination,
      status: 'Proposal Sent',
      notes: `Generated proposal: ${proposal.name || 'Safari Adventure'}`
    });
  }
}
