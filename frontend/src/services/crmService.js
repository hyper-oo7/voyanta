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
        const local = getLocalClients();
        const localMap = new Map();
        local.forEach(c => localMap.set(String(c.id), c));
        
        const mergedData = data.map(dbC => {
          if (localMap.has(String(dbC.id))) {
            return { ...dbC, ...localMap.get(String(dbC.id)) };
          }
          return dbC;
        });
        
        local.forEach(c => {
          if (!mergedData.some(m => String(m.id) === String(c.id))) {
            mergedData.push(c);
          }
        });

        saveLocalClients(mergedData);
        return { data: mergedData, count: count || mergedData.length, page, pageSize };
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
    try {
      const { data, error } = await supabase.from(TABLE).insert([newClient]).select().single();
      if (!error && data) {
        const list = getLocalClients();
        saveLocalClients([data, ...list]);
        try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
        return data;
      }
      if (error) {
        console.warn('Supabase createClient error (falling back to local cache):', error);
      }
    } catch (e) {
      console.warn('Supabase createClient exception (falling back to local cache):', e);
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

  if (supabase && !String(id).startsWith('inv_client_')) {
    try {
      const { data, error } = await supabase.from(TABLE).update(updatePayload).eq('id', id).select().single();
      if (!error && data) {
        const list = getLocalClients().map(c => String(c.id) === String(id) ? { ...c, ...data } : c);
        saveLocalClients(list);
        try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
        return data;
      }
      if (error) {
        console.warn('Supabase updateClient error (falling back to local cache):', error);
      }
    } catch (e) {
      console.warn('Supabase updateClient exception (falling back to local cache):', e);
    }
  }

  let list = getLocalClients();
  const exists = list.some(c => String(c.id) === String(id));
  if (!exists) {
    list = [{ id, updated_at: now, ...patch }, ...list];
  } else {
    list = list.map(c => String(c.id) === String(id) ? { ...c, ...updatePayload } : c);
  }
  saveLocalClients(list);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch {}
  const updated = list.find(c => String(c.id) === String(id));
  return updated || { id, ...updatePayload };
}

export async function deleteClient(id) {
  if (supabase && !String(id).startsWith('inv_client_')) {
    try {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) {
        console.warn('Supabase deleteClient error (falling back to local cache):', error);
      }
    } catch (e) {
      console.warn('Supabase deleteClient exception (falling back to local cache):', e);
    }
  }
  const list = getLocalClients().filter(c => String(c.id) !== String(id));
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
