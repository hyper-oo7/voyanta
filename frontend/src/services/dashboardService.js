import { fetchProposals } from './proposalService.js';

export async function fetchDashboardSummary() {
  const proposals = await fetchProposals();
  const recentProposals = proposals.slice(0, 4);
  return {
    totalProposals: proposals.length,
    totalTemplates: 45, // Library content still seeded statically — counted in templatesService later
    activeClients: new Set(proposals.map((p) => p.client_name).filter(Boolean)).size,
    recentProposals,
    recentActivity: [
      { id: 1, type: 'mail', title: 'Proposal Sent', detail: "Alex sent 'Tokyo Neon Nights' to Marcus Thorne.", when: '2 HOURS AGO' },
      { id: 2, type: 'check_circle', title: 'Proposal Accepted', detail: "'Alpine Escape' was accepted by Eleanor Vance.", when: '5 HOURS AGO' },
      { id: 3, type: 'update', title: 'Database Sync', detail: 'Global hotel inventory updated successfully.', when: 'YESTERDAY' },
    ],
  };
}
