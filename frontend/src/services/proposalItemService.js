import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

// Proposal items (junction): hotels/flights/activities/transfers/etc on a proposal.
// Pricing fields (qty * unit_price) are summed by the cost calculator.

export async function listItems(proposalId) {
  if (!supabase || !proposalId) return [];
  const { data, error } = await supabase.from('proposal_items')
    .select('*').eq('proposal_id', proposalId).order('position', { ascending: true });
  if (error) throw error;
  return data || [];
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
  if (!supabase) throw new Error('Supabase not configured');
  const [{ data: proposal }, items] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', proposalId).single(),
    listItems(proposalId),
  ]);
  const grouped = {};
  for (const it of items) (grouped[it.kind] ||= []).push(it);
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    agency_id: DEFAULT_AGENCY_ID,
    proposal: proposal || null,
    items_by_kind: grouped,
    items,
    totals: { subtotal: total, currency: proposal?.currency || 'INR' },
  };
}
