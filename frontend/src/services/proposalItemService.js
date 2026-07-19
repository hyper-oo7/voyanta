import { supabase, getAgencyId, isDemoSession } from '../lib/supabaseClient.js';

// Proposal items (junction): hotels/flights/activities/transfers/etc on a proposal.
// Pricing fields (qty * unit_price) are summed by the cost calculator.

function notifyDbError(resource, error) {
  console.error(`Supabase DB Error in ${resource}:`, error);
  window.dispatchEvent(
    new CustomEvent('voyanta:database-error', {
      detail: { resource, error: error?.message || String(error) },
    })
  );
}

export async function listItems(proposalId) {
  if (!proposalId) return [];
  if (supabase && !isDemoSession()) {
    try {
      const { data, error } = await supabase.from('proposal_items')
        .select('*').eq('proposal_id', proposalId).order('position', { ascending: true });
      if (!error && data) return data;
    } catch (e) {
      console.warn('listItems Supabase error, falling back to localStorage:', e);
    }
  }
  try {
    const prop = JSON.parse(localStorage.getItem(`voyanta_proposal_${proposalId}`) || 'null');
    if (prop && Array.isArray(prop.items)) return prop.items;
  } catch {}
  return [];
}

const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export async function addItem(proposalId, item) {
  const checkId = item.id;
  const validId = isUuid(checkId) ? checkId : crypto.randomUUID();
  const validRefId = item.ref_id || (!isUuid(checkId) && checkId ? checkId : undefined);
  const sanitizedItem = { ...item, id: validId };
  if (validRefId) {
    sanitizedItem.ref_id = validRefId;
  }

  if (supabase && !isDemoSession()) {
    const { data, error } = await supabase.from('proposal_items').insert({
      proposal_id: proposalId, ...sanitizedItem,
    }).select().maybeSingle();
    if (error) {
      notifyDbError('proposal_items', error);
      throw error;
    }
    if (data) return data;
  }
  const newItem = {
    proposal_id: proposalId,
    created_at: new Date().toISOString(),
    ...sanitizedItem
  };
  try {
    const key = `voyanta_proposal_${proposalId}`;
    const prop = JSON.parse(localStorage.getItem(key) || 'null');
    if (prop) {
      const items = Array.isArray(prop.items) ? [...prop.items, newItem] : [newItem];
      localStorage.setItem(key, JSON.stringify({ ...prop, items }));
    }
  } catch {}
  return newItem;
}

export async function updateItem(id, patch) {
  if (supabase && !isDemoSession()) {
    const { data, error } = await supabase.from('proposal_items').update(patch).eq('id', id).select().maybeSingle();
    if (error) {
      notifyDbError('proposal_items', error);
      throw error;
    }
    if (data) return data;
  }
  let updatedItem = { id, ...patch };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('voyanta_proposal_')) {
        const prop = JSON.parse(localStorage.getItem(k) || 'null');
        if (prop && Array.isArray(prop.items)) {
          const idx = prop.items.findIndex(it => String(it.id) === String(id));
          if (idx !== -1) {
            updatedItem = { ...prop.items[idx], ...patch };
            prop.items[idx] = updatedItem;
            localStorage.setItem(k, JSON.stringify(prop));
            break;
          }
        }
      }
    }
  } catch {}
  return updatedItem;
}

export async function removeItem(id) {
  if (supabase && !isDemoSession()) {
    const { error } = await supabase.from('proposal_items').delete().eq('id', id);
    if (error) {
      notifyDbError('proposal_items', error);
      throw error;
    }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('voyanta_proposal_')) {
        const prop = JSON.parse(localStorage.getItem(k) || 'null');
        if (prop && Array.isArray(prop.items)) {
          const initialLen = prop.items.length;
          const filtered = prop.items.filter(it => String(it.id) !== String(id));
          if (filtered.length !== initialLen) {
            localStorage.setItem(k, JSON.stringify({ ...prop, items: filtered }));
            break;
          }
        }
      }
    }
  } catch {}
}

// Build the structured JSON ready for PDF/PPT/email generators downstream.
export async function buildProposalExport(proposalId) {
  let proposal = null;
  let items = [];
  if (supabase && !isDemoSession()) {
    try {
      const [pRes, itemsRes] = await Promise.all([
        supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle(),
        listItems(proposalId),
      ]);
      if (pRes.data) proposal = pRes.data;
      if (itemsRes) items = itemsRes;
    } catch (e) {
      console.warn('Supabase fetch failed in buildProposalExport, trying localStorage fallback...', e);
    }
  }
  if (!proposal) {
    try {
      proposal = JSON.parse(localStorage.getItem(`voyanta_proposal_${proposalId}`) || 'null');
      if (!proposal) {
        const cachedList = JSON.parse(localStorage.getItem('voyanta_proposals_list_cache') || '[]');
        proposal = cachedList.find(p => String(p.id) === String(proposalId)) || null;
      }
    } catch {}
  }
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }
  if ((!items || items.length === 0) && Array.isArray(proposal.items)) {
    items = proposal.items;
  } else if ((!items || items.length === 0)) {
    items = await listItems(proposalId);
  }
  const grouped = {};
  for (const it of items) {
    const k = (it.kind || 'custom').toLowerCase();
    (grouped[k] ||= []).push(it);
  }
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    agency_id: getAgencyId(),
    proposal: proposal || null,
    items_by_kind: grouped,
    items,
    totals: { subtotal: total, currency: proposal?.currency || 'INR' },
  };
}

export async function fetchSharedProposalByToken(token) {
  if (!supabase) throw new Error("Supabase is required for public shares");
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();
    
  if (error || !proposal) throw new Error("Proposal not found or expired");
  
  // also fetch items
  const { data: items } = await supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('position', { ascending: true });
    
  const grouped = {};
  for (const it of items || []) {
    const k = (it.kind || 'custom').toLowerCase();
    (grouped[k] ||= []).push(it);
  }
  const total = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    proposal: proposal,
    items_by_kind: grouped,
    items: items || [],
    totals: { subtotal: total, currency: proposal.currency || 'INR' },
  };
}
