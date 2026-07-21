import { supabase, getAgencyId, isDemoSession } from '../lib/supabaseClient.js';
import { fetchProposalsFlat } from './proposalService.js';
import { getActivityLogs } from './activityLogService.js';

export async function fetchDashboardSummary() {
  const agencyId = getAgencyId();

  if (!supabase || isDemoSession() || !agencyId) {
    const proposals = await fetchProposalsFlat();
    return fallbackSummary(proposals);
  }

  try {
    const [{ data: stats, error: rpcErr }, { data: recent, error: listErr }] = await Promise.all([
      supabase.rpc('get_dashboard_summary', { p_agency_id: agencyId }),
      supabase.from('proposals').select('id, name, client_name, status, destination, created_at')
        .eq('agency_id', agencyId)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .limit(4)
    ]);

    if (rpcErr || listErr || !stats) {
      throw rpcErr || listErr || new Error('RPC failed');
    }

    // Fetch real activity logs from Supabase
    const activityLogs = await getActivityLogs(5);
    const recentActivity = activityLogs.map((log, i) => ({
      id: log.id || i,
      type: log.type === 'approval' ? 'check_circle' : log.type === 'modification' ? 'edit_note' : log.type === 'pdf' ? 'picture_as_pdf' : 'sync',
      title: log.description?.split(' ').slice(0, 3).join(' ') || log.type || 'Activity',
      detail: log.description || '',
      when: formatRelativeTime(log.timestamp),
    }));

    const result = {
      totalProposals: stats.totalProposals || 0,
      totalTemplates: stats.totalTemplates || 0,
      activeClients: stats.activeClients || 0,
      totalDownloads: stats.totalDownloads || 0,
      totalShares: stats.totalShares || 0,
      totalApprovals: stats.totalApprovals || 0,
      totalModifications: stats.totalModifications || 0,
      recentProposals: (recent || []).map(r => ({
        ...r,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
      })),
      recentActivity: recentActivity.length > 0 ? recentActivity : [],
    };

    return result;
  } catch (err) {
    console.warn('Dashboard summary RPC failed:', err);
    const proposals = await fetchProposalsFlat();
    const activityLogs = await getActivityLogs(5);
    const recentActivity = activityLogs.map((log, i) => ({
      id: log.id || i,
      type: log.type === 'approval' ? 'check_circle' : log.type === 'modification' ? 'edit_note' : log.type === 'pdf' ? 'picture_as_pdf' : 'sync',
      title: log.description?.split(' ').slice(0, 3).join(' ') || log.type || 'Activity',
      detail: log.description || '',
      when: formatRelativeTime(log.timestamp),
    }));
    const summary = fallbackSummary(proposals);
    summary.recentActivity = recentActivity.length > 0 ? recentActivity : [];
    return summary;
  }
}

async function fallbackSummary(proposalsParam) {
  const proposals = Array.isArray(proposalsParam) ? proposalsParam : [];
  const recentProposals = proposals.slice(0, 4);
  
  let recentActivity = [];
  try {
    const activityLogs = await getActivityLogs(10);
    recentActivity = (activityLogs || []).map((log, i) => ({
      id: log.id || i,
      type: log.type === 'approval' ? 'check_circle' : log.type === 'modification' ? 'edit_note' : log.type === 'pdf' ? 'picture_as_pdf' : log.type === 'invoice' ? 'receipt' : log.type === 'crm' ? 'person_add' : 'sync',
      title: log.description?.split(' ').slice(0, 4).join(' ') || log.type || 'Activity',
      detail: log.description || '',
      when: formatRelativeTime(log.timestamp || log.created_at),
    }));
  } catch {}

  return {
    totalProposals: proposals.length,
    totalTemplates: 0,
    activeClients: new Set(proposals.map((p) => p.client_name).filter(Boolean)).size,
    totalDownloads: 0,
    totalShares: 0,
    totalApprovals: 0,
    totalModifications: 0,
    recentProposals,
    recentActivity,
  };
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
