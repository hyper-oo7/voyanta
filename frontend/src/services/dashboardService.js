import { getSupabase } from '../lib/supabaseClient.js';
import { proposals as mockProposals, dashboardSummary as mockSummary } from '../data/proposals.js';
import { recentActivity as mockActivity } from '../data/activity.js';

// Service layer: returns the same shape regardless of mock vs Supabase source.
// Swap to Supabase by setting VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env
// and creating tables matching the shapes documented in /src/data/*.js.

export async function fetchDashboardSummary() {
  const sb = await getSupabase();
  if (sb) {
    const [{ count: totalProposals }, { count: totalTemplates }, { count: activeClients }, { data: recentProposals }] = await Promise.all([
      sb.from('proposals').select('id', { count: 'exact', head: true }),
      sb.from('templates').select('id', { count: 'exact', head: true }),
      sb.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('proposals').select('id,name,client,status,date').order('date', { ascending: false }).limit(4),
    ]);
    return {
      totalProposals: totalProposals ?? 0,
      totalTemplates: totalTemplates ?? 0,
      activeClients: activeClients ?? 0,
      recentProposals: recentProposals ?? [],
      recentActivity: [],
    };
  }
  return {
    ...mockSummary,
    recentProposals: mockProposals.slice(0, 4),
    recentActivity: mockActivity,
  };
}
