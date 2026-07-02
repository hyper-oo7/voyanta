// Helper to track and compute engagement stats (PDF downloads, email/WA shares, approvals, modifications, top destinations)

const DEST_STATS_KEY = 'voyanta_dest_generation_stats';

function getOrSeedDestStats() {
  try {
    const raw = localStorage.getItem(DEST_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Seed default luxury destination data so stat cards and modal look stunning immediately
  const seeded = {
    'Maldives Luxury Resort': { pdf: 12, whatsapp: 18, email: 8, approvals: 14, modifications: 3 },
    'Swiss Alps Expedition': { pdf: 9, whatsapp: 14, email: 5, approvals: 11, modifications: 4 },
    'Kyoto Heritage Tour': { pdf: 7, whatsapp: 10, email: 6, approvals: 8, modifications: 2 },
    'Amalfi Coast Yachting': { pdf: 6, whatsapp: 8, email: 4, approvals: 7, modifications: 1 }
  };
  try { localStorage.setItem(DEST_STATS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

export function addNotification(icon, title, desc) {
  try {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('voyanta_notifications') || '[]'); } catch {}
    if (!Array.isArray(list) || list.length === 0) {
      list = [
        { id: 1, icon: 'mail', title: 'Proposal Sent', desc: "Alex sent 'Tokyo Neon Nights' to Marcus Thorne.", time: '2 hours ago', unread: true },
        { id: 2, icon: 'check_circle', title: 'Proposal Accepted', desc: "'Alpine Escape' was accepted by Eleanor Vance.", time: '5 hours ago', unread: true },
        { id: 3, icon: 'sync', title: 'Database Sync', desc: 'Global hotel inventory updated successfully.', time: 'Yesterday', unread: false }
      ];
    }
    const newNotif = {
      id: Date.now(),
      icon: icon || 'notifications',
      title: title || 'New Notification',
      desc: desc || '',
      time: 'Just now',
      unread: true
    };
    list.unshift(newNotif);
    if (list.length > 20) list = list.slice(0, 20);
    localStorage.setItem('voyanta_notifications', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('voyanta:notifications-updated'));
  } catch (err) {
    console.warn('Failed to add notification:', err);
  }
}

export function getAnalyticsStats(proposals = []) {
  const destStats = getOrSeedDestStats();

  // Also fold in any live proposal destinations that might not be in destStats yet
  proposals.forEach((p) => {
    if (p.destination) {
      const d = p.destination.trim();
      if (d && !destStats[d]) {
        destStats[d] = { pdf: 0, whatsapp: 0, email: 0, approvals: 0, modifications: 0 };
      }
      const stats = p.stats || {};
      if (stats.downloads || stats.whatsapp_shares || stats.email_shares || stats.approvals || stats.modifications) {
        destStats[d].pdf += Number(stats.downloads || 0);
        destStats[d].whatsapp += Number(stats.whatsapp_shares || 0);
        destStats[d].email += Number(stats.email_shares || 0);
        destStats[d].approvals += Number(stats.approvals || 0);
        destStats[d].modifications += Number(stats.modifications || 0);
      }
    }
  });

  let totalDownloads = 0;
  let totalWhatsapp = 0;
  let totalEmail = 0;
  let totalApprovals = 0;
  let totalModifications = 0;

  let mostSentDest = 'None yet';
  let maxSentCount = -1;

  let mostApprovedDest = 'None yet';
  let maxApprovedCount = -1;

  let mostModifiedDest = 'None yet';
  let maxModifiedCount = -1;

  const destinationsList = [];

  Object.entries(destStats).forEach(([dest, counts]) => {
    const pdf = Number(counts.pdf || 0);
    const wa = Number(counts.whatsapp || 0);
    const em = Number(counts.email || 0);
    const app = Number(counts.approvals || 0);
    const mod = Number(counts.modifications || 0);
    const totalGenerated = pdf + wa + em;

    totalDownloads += pdf;
    totalWhatsapp += wa;
    totalEmail += em;
    totalApprovals += app;
    totalModifications += mod;

    if (totalGenerated > maxSentCount && totalGenerated > 0) {
      maxSentCount = totalGenerated;
      mostSentDest = dest;
    }
    if (app > maxApprovedCount && app > 0) {
      maxApprovedCount = app;
      mostApprovedDest = dest;
    }
    if (mod > maxModifiedCount && mod > 0) {
      maxModifiedCount = mod;
      mostModifiedDest = dest;
    }

    destinationsList.push({
      name: dest,
      pdf,
      whatsapp: wa,
      email: em,
      approvals: app,
      modifications: mod,
      totalGenerated
    });
  });

  destinationsList.sort((a, b) => b.totalGenerated - a.totalGenerated);

  const totalEngagement = totalDownloads + totalWhatsapp + totalEmail + totalApprovals + totalModifications;
  return {
    totalDownloads,
    totalWhatsapp,
    totalEmail,
    totalApprovals,
    totalModifications,
    totalEngagement,
    mostSentDest,
    mostApprovedDest,
    mostModifiedDest,
    destinationsList
  };
}

export function incrementAnalytics(type, proposalId, destName, clientName) {
  try {
    let dest = destName || '';
    let client = clientName || '';

    // Lookup destination and client name if not passed
    if (proposalId && (!dest || !client)) {
      try {
        const pStr = localStorage.getItem(`voyanta_proposal_${proposalId}`);
        if (pStr) {
          const p = JSON.parse(pStr);
          if (!dest && p.destination) dest = p.destination;
          if (!client && (p.client_name || p.client)) client = p.client_name || p.client;
          p.stats = p.stats || {};
          if (type === 'download') p.stats.downloads = Number(p.stats.downloads || 0) + 1;
          if (type === 'whatsapp') p.stats.whatsapp_shares = Number(p.stats.whatsapp_shares || 0) + 1;
          if (type === 'email') p.stats.email_shares = Number(p.stats.email_shares || 0) + 1;
          if (type === 'approval') p.stats.approvals = Number(p.stats.approvals || 0) + 1;
          if (type === 'modification') p.stats.modifications = Number(p.stats.modifications || 0) + 1;
          localStorage.setItem(`voyanta_proposal_${proposalId}`, JSON.stringify(p));
        }
      } catch {}
    }

    if (!dest) dest = 'General Destination';
    if (!client) client = 'Valued Client';

    const destStats = getOrSeedDestStats();
    if (!destStats[dest]) {
      destStats[dest] = { pdf: 0, whatsapp: 0, email: 0, approvals: 0, modifications: 0 };
    }

    if (type === 'download') destStats[dest].pdf = Number(destStats[dest].pdf || 0) + 1;
    if (type === 'whatsapp') destStats[dest].whatsapp = Number(destStats[dest].whatsapp || 0) + 1;
    if (type === 'email') destStats[dest].email = Number(destStats[dest].email || 0) + 1;
    if (type === 'approval') {
      destStats[dest].approvals = Number(destStats[dest].approvals || 0) + 1;
      addNotification('check_circle', `Approved by ${client}`, `${client} has approved the proposal plan for ${dest}.`);
    }
    if (type === 'modification') {
      destStats[dest].modifications = Number(destStats[dest].modifications || 0) + 1;
      addNotification('edit_note', `Modified by ${client}`, `${client} has requested modifications to the plan for ${dest}.`);
    }

    try { localStorage.setItem(DEST_STATS_KEY, JSON.stringify(destStats)); } catch {}

    window.dispatchEvent(new CustomEvent('voyanta:analytics-updated'));
  } catch (err) {
    console.warn('Analytics increment failed:', err);
  }
}
