// Analytics service — reads/writes Supabase analytics_events and notifications tables.
// Falls back to localStorage if Supabase is unavailable.
import { supabase, getAgencyId } from '../lib/supabaseClient.js';

// ─── Notifications ───────────────────────────────────────────────────────────
export async function addNotification(icon, title, desc) {
  const agencyId = getAgencyId();
  try {
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      icon: icon || 'notifications',
      title: title || 'New Activity',
      desc: desc || '',
      time: new Date().toLocaleDateString(),
      unread: true,
      ts: Date.now()
    };
    try {
      const existing = JSON.parse(localStorage.getItem('voyanta_notifications') || '[]');
      const updated = Array.isArray(existing) ? [newNotif, ...existing.slice(0, 49)] : [newNotif];
      localStorage.setItem('voyanta_notifications', JSON.stringify(updated));
    } catch {}

    if (supabase) {
      let userId = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch {}
      await supabase.from('notifications').insert({
        agency_id: agencyId,
        user_id: userId,
        icon: icon || 'notifications',
        title: title || 'New Notification',
        description: desc || '',
      });
    }
    window.dispatchEvent(new CustomEvent('voyanta:notifications-updated'));
  } catch (err) {
    console.warn('Failed to add notification:', err);
  }
}

export async function getNotifications(limit = 20) {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data;
    } catch {}
  }
  return [];
}

export async function markNotificationRead(id) {
  if (!supabase) return;
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  window.dispatchEvent(new CustomEvent('voyanta:notifications-updated'));
}

// ─── Analytics Stats (from Supabase) ─────────────────────────────────────────
export async function getAnalyticsStats(proposals = []) {
  const agencyId = getAgencyId();

  // Try Supabase RPC first
  if (supabase) {
    try {
      const { data: destData, error: destErr } = await supabase.rpc('get_destination_analytics', { p_agency_id: agencyId });
      const { data: summary, error: sumErr } = await supabase.rpc('get_dashboard_summary', { p_agency_id: agencyId });

      if (!destErr && !sumErr && summary) {
        const destinationsList = Array.isArray(destData) ? destData : [];

        let totalDownloads = 0, totalWhatsapp = 0, totalEmail = 0;
        let totalApprovals = 0, totalModifications = 0;
        let mostSentDest = 'None yet', maxSentCount = -1;
        let mostApprovedDest = 'None yet', maxApprovedCount = -1;
        let mostModifiedDest = 'None yet', maxModifiedCount = -1;

        destinationsList.forEach(d => {
          const pdf = Number(d.pdf || 0);
          const wa = Number(d.whatsapp || 0);
          const em = Number(d.email || 0);
          const app = Number(d.approvals || 0);
          const mod = Number(d.modifications || 0);
          const total = pdf + wa + em;

          totalDownloads += pdf;
          totalWhatsapp += wa;
          totalEmail += em;
          totalApprovals += app;
          totalModifications += mod;

          if (total > maxSentCount && total > 0) { maxSentCount = total; mostSentDest = d.name; }
          if (app > maxApprovedCount && app > 0) { maxApprovedCount = app; mostApprovedDest = d.name; }
          if (mod > maxModifiedCount && mod > 0) { maxModifiedCount = mod; mostModifiedDest = d.name; }
        });

        const totalEngagement = totalDownloads + totalWhatsapp + totalEmail + totalApprovals + totalModifications;
        return {
          totalDownloads, totalWhatsapp, totalEmail,
          totalApprovals, totalModifications, totalEngagement,
          mostSentDest, mostApprovedDest, mostModifiedDest,
          destinationsList,
        };
      }
    } catch (e) {
      console.warn('Analytics RPC failed, returning empty stats:', e);
    }
  }

  // Fallback: empty stats
  return {
    totalDownloads: 0, totalWhatsapp: 0, totalEmail: 0,
    totalApprovals: 0, totalModifications: 0, totalEngagement: 0,
    mostSentDest: 'None yet', mostApprovedDest: 'None yet', mostModifiedDest: 'None yet',
    destinationsList: [],
  };
}

// ─── Increment Analytics ─────────────────────────────────────────────────────
export async function incrementAnalytics(type, proposalId, destName, clientName) {
  const agencyId = getAgencyId();
  const eventTypeMap = {
    'download': 'download',
    'whatsapp': 'whatsapp',
    'email': 'email',
    'approval': 'approval',
    'modification': 'modification',
  };
  const eventType = eventTypeMap[type];
  if (!eventType) return;

  try {
    let userId = null;
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch {}
    }

    const dest = destName || 'General Destination';
    const client = clientName || 'Valued Client';

    // Write to Supabase
    if (supabase) {
      await supabase.from('analytics_events').insert({
        agency_id: agencyId,
        user_id: userId,
        proposal_id: proposalId || null,
        event_type: eventType,
        destination: dest,
        client_name: client,
      });
    }

    // Fire notification for approvals/modifications
    if (type === 'approval') {
      await addNotification('check_circle', `Approved by ${client}`, `${client} has approved the proposal plan for ${dest}.`);
    }
    if (type === 'modification') {
      await addNotification('edit_note', `Modified by ${client}`, `${client} has requested modifications to the plan for ${dest}.`);
    }

    window.dispatchEvent(new CustomEvent('voyanta:analytics-updated'));
  } catch (err) {
    console.warn('Analytics increment failed:', err);
  }
}
