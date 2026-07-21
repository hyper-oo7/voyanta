import { supabase, getAgencyId, DEMO_AGENCY_ID } from '../lib/supabaseClient.js';

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

export const VALID_CLIENT_STATUSES = ['Inquiry', 'Proposal Sent', 'Approved', 'Booked', 'Completed', 'Cancelled'];

export function sanitizeStatus(status) {
  if (!status) return 'Inquiry';
  if (VALID_CLIENT_STATUSES.includes(status)) return status;
  const match = VALID_CLIENT_STATUSES.find(s => s.toLowerCase() === String(status).toLowerCase());
  return match || 'Inquiry';
}

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
  } catch { }
}

export async function fetchClients({ page = 0, pageSize = PAGE_SIZE, status = null } = {}) {
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;

  if (isProd) {
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
        // Strict Cloud Sync: Replace local cache entirely if on page 0 without status filter.
        // This ensures stale/deleted records on local device are expunged.
        if (page === 0 && (!status || status === 'ALL')) {
          saveLocalClients(data);
        }
        return { data, count: count || data.length, page, pageSize };
      }
    } catch (e) {
      console.warn('Supabase fetchClients failed, falling back to localStorage:', e);
    }
  }

  // Fast-loading fallback / Demo Mode
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
  const normEmail = (clientData.email || '').trim().toLowerCase();
  const normName = (clientData.name || '').trim().toLowerCase();

  const list = getLocalClients();
  let existing = null;
  if (normEmail) {
    existing = list.find(c => c.email && c.email.trim().toLowerCase() === normEmail);
  }
  if (!existing && normName && normName !== 'unnamed client' && normName !== 'valued client') {
    existing = list.find(c => c.name && c.name.trim().toLowerCase() === normName);
  }
  if (existing) {
    return updateClient(existing.id, clientData);
  }

  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;
  const now = new Date().toISOString();

  const validStatus = sanitizeStatus(clientData.status);

  // Filter payload to only include valid Supabase columns for public.clients
  const rawId = clientData.id;
  const isValidUuid = rawId && typeof rawId === 'string' && !rawId.startsWith('manual_') && !rawId.startsWith('proposal_') && !rawId.startsWith('invoice_') && !rawId.startsWith('receipt_');
  const clientId = isValidUuid ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }));

  const newClient = {
    id: clientId,
    name: (clientData.name || 'Unnamed Client').trim(),
    email: (clientData.email || '').trim(),
    phone: (clientData.phone || '').trim(),
    destination: clientData.destination || '',
    status: validStatus,
    notes: clientData.notes || '',
    preferences: clientData.preferences || {},
    tags: Array.isArray(clientData.tags) ? clientData.tags : [],
    total_spend: Number(clientData.total_spend) || 0,
    created_at: now,
    updated_at: now,
    agency_id: agencyId
  };

  if (isProd) {
    console.log("clientData", clientData);
    console.log("newClient", newClient);
    const { data, error } = await supabase.from(TABLE).insert([newClient]).select().single();
    if (error) {
      notifyDbError('createClient', error);
      throw error;
    }
    // Update cache with server-verified data
    const updatedList = [data, ...getLocalClients().filter(c => c.id !== data.id)];
    saveLocalClients(updatedList);
    if (data.status) syncStatusToInvoices(data, data.status);
    try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch { }
    return data;
  }

  // Demo mode
  const updated = [newClient, ...getLocalClients()];
  saveLocalClients(updated);
  if (newClient.status) syncStatusToInvoices(newClient, newClient.status);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch { }
  return newClient;
}

function syncStatusToInvoices(client, newStatus) {
  if (!newStatus || !client) return;
  try {
    const raw = localStorage.getItem('voyanta_invoices_data') || '[]';
    let invList = JSON.parse(raw);
    if (!Array.isArray(invList)) invList = [];
    let updated = false;
    invList = invList.map(inv => {
      const match = (inv.client_name && client.name && inv.client_name.trim().toLowerCase() === client.name.trim().toLowerCase()) ||
        (inv.client_email && client.email && inv.client_email.trim().toLowerCase() === client.email.trim().toLowerCase()) ||
        String(inv.id) === `crm_${client.id}` || String(inv.id) === `inv_client_${client.id}`;
      if (match) {
        updated = true;
        return {
          ...inv,
          crm_status: newStatus,
          status: newStatus === 'Booked' ? 'Paid' : (newStatus === 'Approved' && inv.status === 'Draft' ? 'Sent' : inv.status)
        };
      }
      return inv;
    });
    if (!updated && ['Approved', 'Booked', 'Proposal Sent'].includes(newStatus)) {
      const autoInv = {
        id: `crm_${client.id}`,
        invoice_number: `INV-${1000 + (Math.abs(String(client.id).split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 9000)}`,
        client_name: client.name || 'Client',
        client_email: client.email || '',
        client_phone: client.phone || '',
        destination: client.destination || '',
        total_amount: Number(client.budget || client.total_amount || 0),
        paid_amount: newStatus === 'Booked' ? Number(client.budget || client.total_amount || 0) : 0,
        remaining_balance: newStatus === 'Booked' ? 0 : Number(client.budget || client.total_amount || 0),
        status: newStatus === 'Booked' ? 'Paid' : (newStatus === 'Approved' ? 'Sent' : 'Draft'),
        crm_status: newStatus,
        created_at: new Date().toISOString(),
        taxes: [{ id: 'tax-1', name: 'GST / Tax', rate: 5, amount: Math.round(Number(client.budget || 0) * 0.05) }],
        is_auto_linked: true
      };
      invList = [autoInv, ...invList];
    }
    localStorage.setItem('voyanta_invoices_data', JSON.stringify(invList));
    try { window.dispatchEvent(new CustomEvent('voyanta:invoices-updated')); } catch { }
  } catch (e) {
    console.error('Failed to sync invoice status:', e);
  }
}

export async function updateClient(id, patch) {
  const now = new Date().toISOString();
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;

  // Strip agency_id from updates to avoid RLS constraint checks
  const { agency_id, ...cleanPatch } = patch;
  if (cleanPatch.status) {
    cleanPatch.status = sanitizeStatus(cleanPatch.status);
  }
  const updatePayload = { ...cleanPatch, agency_id: agencyId, updated_at: now };

  if (isProd && !String(id).startsWith('inv_client_')) {
    const { data, error } = await supabase.from(TABLE).update(updatePayload).eq('id', id).select().single();
    if (error) {
      notifyDbError('updateClient', error);
      throw error;
    }
    const list = getLocalClients().map(c => String(c.id) === String(id) ? { ...c, ...data } : c);
    saveLocalClients(list);
    if (data.status) syncStatusToInvoices(data, data.status);
    try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch { }
    return data;
  }

  // Local / Demo Mode or auto-linked inv_client_ records
  let list = getLocalClients();
  let existingIndex = list.findIndex(c => String(c.id) === String(id));
  if (existingIndex === -1 && patch.name) {
    existingIndex = list.findIndex(c => c.name && c.name.trim().toLowerCase() === patch.name.trim().toLowerCase());
  }
  if (existingIndex === -1 && patch.email) {
    existingIndex = list.findIndex(c => c.email && c.email.trim().toLowerCase() === patch.email.trim().toLowerCase());
  }

  if (existingIndex === -1) {
    list = [{ id, updated_at: now, ...patch }, ...list];
    saveLocalClients(list);
  } else {
    const targetId = list[existingIndex].id;
    list = list.map(c => String(c.id) === String(targetId) ? { ...c, ...updatePayload } : c);
    saveLocalClients(list);
  }
  const updated = list.find(c => String(c.id) === String(id));
  if (patch.status && updated) syncStatusToInvoices(updated, patch.status);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch { }
  return updated || { id, ...updatePayload };
}

export async function deleteClient(id) {
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;

  if (isProd && !String(id).startsWith('inv_client_')) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      notifyDbError('deleteClient', error);
      throw error;
    }
  }

  const list = getLocalClients().filter(c => String(c.id) !== String(id));
  saveLocalClients(list);
  try { window.dispatchEvent(new CustomEvent('voyanta:crm-updated')); } catch { }
  return true;
}

export async function upsertClientFromProposal(proposal) {
  if (!proposal) return null;
  const name = proposal.client_name || proposal.customer_name || proposal.client || proposal.brief?.client_name || proposal.brief?.customer_name || 'Valued Client';
  const email = proposal.client_email || proposal.email || proposal.brief?.client_email || proposal.brief?.email || '';
  const phone = proposal.client_phone || proposal.phone || proposal.brief?.client_phone || proposal.brief?.phone || '';
  const destination = proposal.destination || proposal.brief?.destination || '';

  const normEmail = email.trim().toLowerCase();
  const normName = name.trim().toLowerCase();
  const normPhone = phone.replace(/\D/g, '');
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;

  let existing = null;

  // Extract client preferences from proposal brief
  const brief = proposal.brief || {};
  const clientPreferences = {
    dietary: brief.dietary || '',
    pace: brief.pace || '',
    dislikes: brief.dislikes || [],
    avoid: brief.dislikes || []
  };

  if (isProd) {
    try {
      if (normEmail) {
        const { data } = await supabase.from(TABLE).select('*').eq('agency_id', agencyId).ilike('email', normEmail).limit(1);
        if (data && data.length > 0) existing = data[0];
      }
      if (!existing && normName && normName !== 'valued client') {
        const { data } = await supabase.from(TABLE).select('*').eq('agency_id', agencyId).ilike('name', normName).limit(1);
        if (data && data.length > 0) existing = data[0];
      }
    } catch { }
  } else {
    // Demo Mode lookup
    const list = getLocalClients();
    if (normEmail) {
      existing = list.find(c => c.email && c.email.trim().toLowerCase() === normEmail);
    }
    if (!existing && normName && normName !== 'valued client') {
      existing = list.find(c => c.name && c.name.trim().toLowerCase() === normName);
    }
    if (!existing && normPhone && normPhone.length >= 7) {
      existing = list.find(c => c.phone && c.phone.replace(/\D/g, '') === normPhone);
    }
  }

  const targetStatus = sanitizeStatus(proposal.status);

  if (existing) {
    return updateClient(existing.id, {
      status: targetStatus,
      destination: destination || existing.destination,
      phone: phone || existing.phone,
      preferences: {
        ...(existing.preferences || {}),
        ...clientPreferences
      }
    });
  } else {
    return createClient({
      name,
      email,
      phone,
      destination,
      status: targetStatus,
      notes: `Generated proposal: ${proposal.name || 'Safari Adventure'}`,
      preferences: clientPreferences
    });
  }
}

/**
 * Searches for a client matching a phone number or email, in production (Supabase)
 * or local fallback (Demo mode).
 */
export async function findClientByContact({ phone, email }) {
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;
  const normEmail = email?.trim().toLowerCase();
  const normPhone = phone?.replace(/\D/g, '');

  if (!normEmail && (!normPhone || normPhone.length < 7)) return null;

  if (isProd) {
    try {
      let query = supabase.from(TABLE).select('*').eq('agency_id', agencyId);

      const conditions = [];
      if (normEmail) {
        conditions.push(`email.ilike.${normEmail}`);
      }
      if (normPhone && normPhone.length >= 7) {
        conditions.push(`phone.like.%${normPhone}%`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
        const { data, error } = await query.limit(1).maybeSingle();
        if (!error && data) return data;
      }
    } catch (e) {
      console.warn('Supabase findClientByContact failed, trying local lookup:', e);
    }
  }

  // Fallback to local clients cache
  const list = getLocalClients();
  if (normEmail) {
    const found = list.find(c => c.email && c.email.trim().toLowerCase() === normEmail);
    if (found) return found;
  }
  if (normPhone && normPhone.length >= 7) {
    const found = list.find(c => c.phone && c.phone.replace(/\D/g, '') === normPhone);
    if (found) return found;
  }

  return null;
}
