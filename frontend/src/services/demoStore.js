// Demo-mode proposal store: kept in localStorage so demo flows feel real
// (refresh-persistent) without touching Supabase.
const KEY = 'voyanta_demo_proposals';

const SEED = [
  { id: 'demo-1', name: 'Alpine Escape: St. Moritz', client_name: 'Eleanor Vance', status: 'Accepted', date: 'Oct 24, 2023', total_cost: 18450, currency: 'USD' },
  { id: 'demo-2', name: 'Tokyo Neon Nights',         client_name: 'Marcus Thorne',  status: 'Sent',     date: 'Oct 22, 2023', total_cost: 22980, currency: 'USD' },
  { id: 'demo-3', name: 'Amalfi Coast Luxury',       client_name: 'Sophia Rossi',   status: 'Draft',    date: 'Oct 21, 2023', total_cost: 15400, currency: 'EUR' },
  { id: 'demo-4', name: 'Safari Serenity: Kenya',    client_name: 'Jameson Blake',  status: 'Sent',     date: 'Oct 19, 2023', total_cost: 31200, currency: 'USD' },
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    return JSON.parse(raw);
  } catch { return [...SEED]; }
}
function save(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); }

export const demoStore = {
  list: () => load().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  get: (id) => load().find((p) => p.id === id) ?? null,
  insert: (row) => {
    const rows = load();
    const r = { id: 'demo-' + Math.random().toString(36).slice(2, 10), created_at: new Date().toISOString(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Draft', currency: 'USD', ...row };
    rows.unshift(r);
    save(rows);
    return r;
  },
  update: (id, patch) => {
    const rows = load();
    const i = rows.findIndex((p) => p.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch };
    save(rows);
    return rows[i];
  },
  remove: (id) => { save(load().filter((p) => p.id !== id)); },
  duplicate: (id) => {
    const src = load().find((p) => p.id === id);
    if (!src) return null;
    return demoStore.insert({ ...src, id: undefined, name: src.name + ' (Copy)', status: 'Draft' });
  },
  reset: () => { localStorage.removeItem(KEY); },
};
