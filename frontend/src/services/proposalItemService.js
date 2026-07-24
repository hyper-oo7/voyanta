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

const VALID_KINDS = ['hotel', 'flight', 'activity', 'transfer', 'meal', 'meals', 'cruise', 'experience', 'custom', 'other'];

function normalizeKind(rawKind) {
  if (!rawKind) return 'custom';
  const k = String(rawKind).toLowerCase().trim();
  if (VALID_KINDS.includes(k)) return k;
  if (k === 'food' || k === 'dining' || k === 'restaurant') return 'meal';
  if (k === 'cab' || k === 'drive' || k === 'car' || k === 'bus' || k === 'train') return 'transfer';
  if (k === 'tour' || k === 'excursion' || k === 'sightseeing') return 'activity';
  return 'custom';
}

export async function addItem(proposalId, item) {
  const checkId = item.id;
  const validId = isUuid(checkId) ? checkId : crypto.randomUUID();
  const validRefId = item.ref_id || (!isUuid(checkId) && checkId ? checkId : undefined);
  const safeKind = normalizeKind(item.kind);
  const sanitizedItem = { ...item, id: validId, kind: safeKind };
  if (validRefId) {
    sanitizedItem.ref_id = validRefId;
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

  if (supabase && !isDemoSession()) {
    supabase.from('proposal_items').insert({
      proposal_id: proposalId, ...sanitizedItem,
    }).select().maybeSingle().then(({ error }) => {
      if (error) console.warn('Supabase DB notice (proposal_items):', error.message);
    }).catch(err => console.warn('Background addItem failed:', err));
  }
  
  return newItem;
}

export async function updateItem(id, patch) {
  const sanitizedPatch = { ...patch };
  if (sanitizedPatch.kind) {
    sanitizedPatch.kind = normalizeKind(sanitizedPatch.kind);
  }
  let updatedItem = { id, ...sanitizedPatch };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('voyanta_proposal_')) {
        const prop = JSON.parse(localStorage.getItem(k) || 'null');
        if (prop && Array.isArray(prop.items)) {
          const idx = prop.items.findIndex(it => String(it.id) === String(id));
          if (idx !== -1) {
            updatedItem = { ...prop.items[idx], ...sanitizedPatch };
            prop.items[idx] = updatedItem;
            localStorage.setItem(k, JSON.stringify(prop));
            break;
          }
        }
      }
    }
  } catch {}

  if (supabase && !isDemoSession()) {
    supabase.from('proposal_items').update(sanitizedPatch).eq('id', id).select().maybeSingle().then(({ error }) => {
      if (error) console.warn('Supabase DB notice (proposal_items):', error.message);
    }).catch(err => console.warn('Background updateItem failed:', err));
  }
  
  return updatedItem;
}

export async function removeItem(id) {
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

  if (supabase && !isDemoSession()) {
    supabase.from('proposal_items').delete().eq('id', id).then(({ error }) => {
      if (error) notifyDbError('proposal_items', error);
    }).catch(err => console.warn('Background removeItem failed:', err));
  }
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
