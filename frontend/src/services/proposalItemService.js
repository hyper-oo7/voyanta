import { supabase, getAgencyId } from '../lib/supabaseClient.js';

// Proposal items (junction): hotels/flights/activities/transfers/etc on a proposal.
// Pricing fields (qty * unit_price) are summed by the cost calculator.

export async function listItems(proposalId) {
  if (!proposalId) return [];
  if (supabase) {
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

export async function addItem(proposalId, item) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('proposal_items').insert({
    proposal_id: proposalId, ...item,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, patch) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('proposal_items').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeItem(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('proposal_items').delete().eq('id', id);
  if (error) throw error;
}

// Build the structured JSON ready for PDF/PPT/email generators downstream.
export async function buildProposalExport(proposalId) {
  let proposal = null;
  let items = [];
  if (supabase) {
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
