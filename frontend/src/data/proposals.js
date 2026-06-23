// Mock proposals — shape mirrors the future Supabase `proposals` table.
// id (uuid), name (text), client (text), status (enum), date (timestamptz),
// total_cost (numeric), currency (text), created_by (uuid).
export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'];

export const proposals = [
  {
    id: '7c1a3b1d-0001-4a2b-9c12-aaaaaaaaaaaa',
    name: 'Alpine Escape: St. Moritz',
    client: 'Eleanor Vance',
    status: 'Accepted',
    date: 'Oct 24, 2023',
    total_cost: 18450,
    currency: 'USD',
    created_by: 'agent-alex',
  },
  {
    id: '7c1a3b1d-0002-4a2b-9c12-bbbbbbbbbbbb',
    name: 'Tokyo Neon Nights',
    client: 'Marcus Thorne',
    status: 'Sent',
    date: 'Oct 22, 2023',
    total_cost: 22980,
    currency: 'USD',
    created_by: 'agent-alex',
  },
  {
    id: '7c1a3b1d-0003-4a2b-9c12-cccccccccccc',
    name: 'Amalfi Coast Luxury',
    client: 'Sophia Rossi',
    status: 'Draft',
    date: 'Oct 21, 2023',
    total_cost: 15400,
    currency: 'EUR',
    created_by: 'agent-alex',
  },
  {
    id: '7c1a3b1d-0004-4a2b-9c12-dddddddddddd',
    name: 'Safari Serenity: Kenya',
    client: 'Jameson Blake',
    status: 'Sent',
    date: 'Oct 19, 2023',
    total_cost: 31200,
    currency: 'USD',
    created_by: 'agent-alex',
  },
];

export const dashboardSummary = {
  totalProposals: 128,
  totalTemplates: 45,
  activeClients: 12,
};
