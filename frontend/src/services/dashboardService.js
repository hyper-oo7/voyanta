import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { fetchProposals } from './proposalService.js';

const CACHE_KEY = 'voyanta_dashboard_summary_cache';

export async function fetchDashboardSummary() {
  if (!supabase) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) return cached;
    } catch {}
    const proposals = await fetchProposals();
    return fallbackSummary(proposals);
  }

  try {
    const [{ data: stats, error: rpcErr }, { data: recent, error: listErr }] = await Promise.all([
      supabase.rpc('get_dashboard_summary', { p_agency_id: DEFAULT_AGENCY_ID }),
      supabase.from('proposals').select('id, name, client_name, status, destination, created_at')
        .eq('agency_id', DEFAULT_AGENCY_ID)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .limit(4)
    ]);

    if (rpcErr || listErr || !stats) {
      throw rpcErr || listErr || new Error('RPC failed');
    }

    const result = {
      totalProposals: stats.totalProposals || 0,
      totalTemplates: stats.totalTemplates || 45,
      activeClients: stats.activeClients || 0,
      recentProposals: (recent || []).map(r => ({
        ...r,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
      })),
      recentActivity: [
        { id: 1, type: 'mail', title: 'Proposal Sent', detail: "Alex sent 'Tokyo Neon Nights' to Marcus Thorne.", when: '2 HOURS AGO' },
        { id: 2, type: 'check_circle', title: 'Proposal Accepted', detail: "'Alpine Escape' was accepted by Eleanor Vance.", when: '5 HOURS AGO' },
        { id: 3, type: 'update', title: 'Database Sync', detail: 'Global hotel inventory updated successfully.', when: 'YESTERDAY' },
      ],
    };

    try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch (err) {
    // Fallback to localStorage cache or lightweight proposal list if RPC fails (e.g. before migration is run)
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) return cached;
    } catch {}
    const proposals = await fetchProposals();
    return fallbackSummary(proposals);
  }
}

function fallbackSummary(proposals) {
  const recentProposals = proposals.slice(0, 4);
  return {
    totalProposals: proposals.length,
    totalTemplates: 45,
    activeClients: new Set(proposals.map((p) => p.client_name).filter(Boolean)).size,
    recentProposals,
    recentActivity: [
      { id: 1, type: 'mail', title: 'Proposal Sent', detail: "Alex sent 'Tokyo Neon Nights' to Marcus Thorne.", when: '2 HOURS AGO' },
      { id: 2, type: 'check_circle', title: 'Proposal Accepted', detail: "'Alpine Escape' was accepted by Eleanor Vance.", when: '5 HOURS AGO' },
      { id: 3, type: 'update', title: 'Database Sync', detail: 'Global hotel inventory updated successfully.', when: 'YESTERDAY' },
    ],
  };
}
