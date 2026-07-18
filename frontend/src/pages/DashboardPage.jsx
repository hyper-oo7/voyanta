import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useProposals } from '../hooks/useProposals.js';
import { useAuthStore } from '../store/authStore.js';
import { getAnalyticsStats } from '../services/analyticsService.js';
import { fetchDashboardSummary } from '../services/dashboardService.js';
import { getActivityLogs } from '../services/activityLogService.js';
import { fetchInvoices } from '../services/invoiceService.js';
import { fetchClients } from '../services/crmService.js';
import { TEMPLATE_LIST } from '../templates/registry.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  
  const { proposals, isLoading: loadingProposals } = useProposals();

  const [proposalsCollapsed, setProposalsCollapsed] = useState(false);
  const [proposalsEnlarged, setProposalsEnlarged] = useState(false);
  const [showDestModal, setShowDestModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const [totalInvoicesCount, setTotalInvoicesCount] = useState(0);
  const [invoicesList, setInvoicesList] = useState([]);
  const [crmClientsCount, setCrmClientsCount] = useState(0);
  
  // Server-side dashboard stats
  const [serverStats, setServerStats] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalDownloads: 0, totalWhatsapp: 0, totalEmail: 0,
    totalApprovals: 0, totalModifications: 0, totalEngagement: 0,
    mostSentDest: 'None yet', mostApprovedDest: 'None yet', mostModifiedDest: 'None yet',
    destinationsList: [],
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [outcomeInsights, setOutcomeInsights] = useState(null);

  useEffect(() => {
    let token = null;
    (async () => {
      try {
        const supa = (await import('../lib/supabaseClient.js')).supabase;
        const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
        if (session?.access_token) token = session.access_token;
      } catch {}

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch('/api/agencies/outcome-insights', { headers });
        if (res.ok) {
          const data = await res.json();
          setOutcomeInsights(data);
        }
      } catch (err) {
        console.error('Failed to load outcome insights:', err);
      }
    })();
  }, [proposals]);

  // Fetch server-side stats on mount and analytics updates
  useEffect(() => {
    fetchDashboardSummary().then(data => {
      setServerStats(data);
      setRecentActivity(data.recentActivity || []);
    }).catch(console.warn);

    getAnalyticsStats(proposals).then(setAnalytics).catch(console.warn);
    fetchInvoices().then(list => {
      setInvoicesList(list || []);
      setTotalInvoicesCount((list || []).length);
    }).catch(() => {});
    fetchClients().then(res => {
      setCrmClientsCount(res?.count || (res?.data || []).length || 0);
    }).catch(() => {});
  }, [analyticsVersion, proposals]);

  useEffect(() => {
    const handler = () => setAnalyticsVersion(v => v + 1);
    window.addEventListener('voyanta:analytics-updated', handler);
    window.addEventListener('voyanta:activity-log-updated', handler);
    window.addEventListener('voyanta:proposals-updated', handler);
    return () => {
      window.removeEventListener('voyanta:analytics-updated', handler);
      window.removeEventListener('voyanta:activity-log-updated', handler);
      window.removeEventListener('voyanta:proposals-updated', handler);
    };
  }, []);

  const loading = loadingProposals;
  const safeProposalsList = Array.isArray(proposals) ? proposals : [];

  // Compute accurate KPI counts
  const totalProposals = Math.max(serverStats?.totalProposals || 0, safeProposalsList.length);
  const totalTemplates = TEMPLATE_LIST.length;
  const activeClients = useMemo(() => {
    const namesOrEmails = new Set();
    const add = (name, email) => {
      const k = (email || name || '').trim().toLowerCase();
      if (k && k !== 'unnamed client' && k !== 'valued client' && k !== '—') namesOrEmails.add(k);
    };
    // 1. Proposals
    safeProposalsList.forEach(p => add(p.client_name || p.client, p.client_email));
    // 2. CRM Clients
    try {
      const crm = JSON.parse(localStorage.getItem('voyanta_crm_clients') || '[]');
      crm.forEach(c => add(c.name, c.email));
    } catch {}
    // 3. Contacts
    try {
      const cont = JSON.parse(localStorage.getItem('voyanta_crm_contacts') || '[]');
      cont.forEach(c => add(c.name, c.email));
    } catch {}
    // 4. Invoices
    try {
      const invs = JSON.parse(localStorage.getItem('voyanta_invoices_data') || '[]');
      invs.forEach(i => add(i.client_name, i.client_email));
    } catch {}
    // 5. Receipts
    try {
      const recs = JSON.parse(localStorage.getItem('voyanta_receipts_data') || '[]');
      recs.forEach(r => add(r.client_name, r.client_email));
    } catch {}
    return Math.max(namesOrEmails.size, crmClientsCount, serverStats?.activeClients || 0);
  }, [safeProposalsList, crmClientsCount, serverStats?.activeClients]);

  // Compute Approvals: approved/booked proposals
  const approvedProposalsCount = safeProposalsList.filter(p => ['Approved', 'Booked'].includes(p?.status)).length;
  const totalApprovalsMetric = safeProposalsList.length === 0
    ? 0
    : Math.max(approvedProposalsCount, Number(analytics.totalApprovals || 0));

  const getMostFreqDest = (list) => {
    const counts = {};
    let max = 0, top = 'None yet';
    list.forEach(item => {
      const d = (item.destination || '').trim();
      if (d && d !== 'Concierge Travel Package' && d !== 'Custom Travel Package') {
        counts[d] = (counts[d] || 0) + 1;
        if (counts[d] > max) { max = counts[d]; top = d; }
      }
    });
    return top;
  };
  const mostSentDestComputed = analytics.mostSentDest !== 'None yet' ? analytics.mostSentDest : getMostFreqDest([...safeProposalsList, ...invoicesList]);
  const mostApprovedDestComputed = analytics.mostApprovedDest !== 'None yet' ? analytics.mostApprovedDest : getMostFreqDest(safeProposalsList.filter(p => ['Approved', 'Booked'].includes(p.status)));
  const mostModifiedDestComputed = analytics.mostModifiedDest !== 'None yet' ? analytics.mostModifiedDest : getMostFreqDest(safeProposalsList.filter(p => p.status === 'Revision Requested'));

  const destinationsListComputed = (() => {
    const destMap = {};

    const getEntry = (rawName) => {
      const name = (rawName || '').trim();
      if (!name || name === 'Concierge Travel Package' || name === 'Custom Travel Package') {
        return null;
      }
      const key = name.toLowerCase();
      if (!destMap[key]) {
        destMap[key] = {
          name,
          pdf: 0,
          whatsapp: 0,
          email: 0,
          approvals: 0,
          modifications: 0,
          totalGenerated: 0,
        };
      }
      return destMap[key];
    };

    // 1. Process proposals
    safeProposalsList.forEach(p => {
      const entry = getEntry(p.destination);
      if (entry) {
        entry.totalGenerated += 1;
        if (['Approved', 'Booked'].includes(p.status)) {
          entry.approvals += 1;
        }
        if (p.status === 'Revision Requested') {
          entry.modifications += 1;
        }
      }
    });

    // 2. Process invoices
    (invoicesList || []).forEach(i => {
      const entry = getEntry(i.destination);
      if (entry) {
        entry.totalGenerated += 1;
        if (['Sent', 'Partially Paid', 'Paid'].includes(i.status)) {
          entry.approvals += 1;
        } else if (i.status === 'Cancelled') {
          entry.approvals = Math.max(0, entry.approvals - 1);
        }
      }
    });

    // 3. Merge database analytics events
    const dbDests = analytics.destinationsList || [];
    dbDests.forEach(ad => {
      const entry = getEntry(ad.name);
      if (entry) {
        entry.pdf += Number(ad.pdf || 0);
        entry.whatsapp += Number(ad.whatsapp || 0);
        entry.email += Number(ad.email || 0);
        entry.approvals = Math.max(entry.approvals, Number(ad.approvals || 0));
        entry.modifications = Math.max(entry.modifications, Number(ad.modifications || 0));
        entry.totalGenerated = Math.max(entry.totalGenerated, Number(ad.totalGenerated || 0));
      }
    });

    return Object.values(destMap).sort((a, b) => b.totalGenerated - a.totalGenerated);
  })();

  const filteredProposals = safeProposalsList.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.client_name || p.client || '').toLowerCase().includes(q) || (p.destination || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-xl max-w-[1200px] mx-auto pb-xxl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg border-b border-outline-variant pb-lg">
        <div>
          <h2 className="font-headline-lg text-[32px] font-bold text-on-surface m-0 tracking-tight">Agent Dashboard</h2>
          <p className="font-body-lg text-on-surface-variant m-0 mt-xs">Your concierge operations at a glance.</p>
        </div>
        <div className="flex items-center gap-md">
          <button 
            onClick={() => {
              const isDark = document.documentElement.classList.toggle('dark');
              localStorage.setItem('theme', isDark ? 'dark' : 'light');
            }}
            className="flex items-center gap-sm px-lg py-md bg-surface-container text-on-surface rounded-lg font-label-md hover:bg-surface-container-high transition-all border border-outline-variant shadow-sm cursor-pointer"
            title="Toggle Dark Mode"
          >
            <span className="material-symbols-outlined text-[20px]">dark_mode</span>
            Theme
          </button>
          <button 
            onClick={() => navigate('/proposals/wizard')}
            className="flex items-center gap-sm px-xl py-md bg-on-surface text-surface rounded-lg font-label-md hover:opacity-90 active:scale-[0.98] transition-all border-none shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create New Proposal
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-lg">
        <StatCard title="TOTAL PROPOSALS" value={loading ? "..." : totalProposals} icon="folder" onClick={() => navigate('/proposals')} />
        <StatCard title="TOTAL TEMPLATES" value={loading ? "..." : totalTemplates} icon="description" onClick={() => navigate('/templates')} />
        <StatCard title="NO OF CLIENTS" value={loading ? "..." : activeClients} icon="person" onClick={() => navigate('/contacts')} />
        <StatCard title="INVOICES & REVENUE" value={loading ? "..." : totalInvoicesCount} icon="account_balance_wallet" onClick={() => navigate('/invoices')} />
      </div>

      {/* Engagement & Analytics Grid - Generation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-lg">
        <MiniStatCard title="PDF DOWNLOADS" value={analytics.totalDownloads} icon="download" color="text-blue-500 bg-blue-500/10" />
        <MiniStatCard title="SHARES (WA / GMAIL)" value={analytics.totalWhatsapp + analytics.totalEmail} subtitle={`${analytics.totalWhatsapp} WA · ${analytics.totalEmail} Email`} icon="share" color="text-emerald-500 bg-emerald-500/10" />
        <MiniStatCard title="TOTAL ENGAGEMENT" value={analytics.totalEngagement} subtitle="PDFs + Emails + WA" icon="monitoring" color="text-purple-500 bg-purple-500/10" />
        <MiniStatCard title="MOST SENT DEST." value={mostSentDestComputed} subtitle="Click for Breakdown" icon="location_on" color="text-amber-500 bg-amber-500/10" isText onClick={() => setShowDestModal(true)} />
      </div>

      {/* Client Action & Plan Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-lg">
        <MiniStatCard title="NO OF APPROVALS" value={totalApprovalsMetric} subtitle="Client Plan Approvals" icon="check_circle" color="text-teal-500 bg-teal-500/10" />
        <MiniStatCard title="NO OF MODIFICATIONS" value={analytics.totalModifications} subtitle="Client Change Requests" icon="edit_note" color="text-rose-500 bg-rose-500/10" />
        <MiniStatCard title="MOST APPROVED DEST." value={mostApprovedDestComputed} subtitle="Top Approved Plan" icon="thumb_up" color="text-indigo-500 bg-indigo-500/10" isText onClick={() => setShowDestModal(true)} />
        <MiniStatCard title="MOST MODIFIED DEST." value={mostModifiedDestComputed} subtitle="Top Modified Plan" icon="rate_review" color="text-orange-500 bg-orange-500/10" isText onClick={() => setShowDestModal(true)} />
      </div>

      {/* Dynamic Conversion Insights Widget */}
      {outcomeInsights && (
        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 border border-outline-variant rounded-2xl p-lg shadow-sm space-y-md">
          <h4 className="font-headline-sm text-sm font-extrabold text-primary m-0 uppercase tracking-widest flex items-center gap-xs">
            <span className="material-symbols-outlined text-[20px] text-primary">analytics</span>
            Conversion Insights
          </h4>
          {outcomeInsights.status === 'pending' ? (
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-md">
              <p className="text-xs text-on-surface-variant m-0 leading-relaxed max-w-xl">
                Proposal conversion insights will appear here automatically once you log at least 50 outcomes (marking proposals as Won/Approved or Lost/Cancelled). This helps analyze tag distributions and templates to boost conversion.
              </p>
              <div className="flex items-center gap-sm">
                <div className="w-32 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (outcomeInsights.current / outcomeInsights.required) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-primary whitespace-nowrap">
                  {outcomeInsights.current} / {outcomeInsights.required}
                </span>
              </div>
            </div>
          ) : !outcomeInsights.insights || outcomeInsights.insights.length === 0 ? (
            <p className="text-xs text-on-surface-variant m-0">No strong styling or template conversion differences detected yet — continue logging outcomes to build patterns.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {outcomeInsights.insights.map((insight, idx) => (
                <div key={idx} className="bg-white border border-outline-variant/60 rounded-xl p-md flex items-start gap-md shadow-sm hover:shadow-md transition-all">
                  <span className="material-symbols-outlined text-primary text-xl mt-xs">auto_awesome</span>
                  <div className="space-y-xs">
                    <p className="text-xs font-bold text-on-surface leading-normal m-0">{insight.message}</p>
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                      {insight.type} Optimization
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="space-y-xl">
          
          {/* Collapsible Proposals Box */}
          <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
            <div 
              onClick={() => setProposalsCollapsed(!proposalsCollapsed)}
              className="px-xl py-lg flex justify-between items-center bg-surface-container-lowest hover:bg-surface-container-low cursor-pointer transition-colors border-b border-outline-variant"
            >
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">folder_open</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface m-0 flex items-center gap-sm">
                    Proposals Explorer
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm font-black uppercase tracking-wider">{proposals.length} Total</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant m-0 mt-0.5">
                    {proposalsCollapsed ? `Click to expand · Latest: ${proposals[0]?.name || 'No proposals yet'}` : 'All active and draft proposals'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-sm" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setProposalsEnlarged(true)}
                  className="px-md py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-lg transition-all flex items-center gap-1 border border-outline-variant shadow-sm"
                  title="Enlarge Proposals View"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                  Enlarge
                </button>
                <button 
                  onClick={() => setProposalsCollapsed(!proposalsCollapsed)}
                  className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant"
                >
                  <span className="material-symbols-outlined text-[20px] transition-transform duration-300" style={{ transform: proposalsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>expand_more</span>
                </button>
              </div>
            </div>
            
            {!proposalsCollapsed && (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto divide-y divide-outline-variant">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                    <tr className="border-b border-outline-variant">
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Proposal Name</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Client</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Destination</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="px-xl py-xxl text-center text-on-surface-variant font-body-md">Loading proposals...</td>
                      </tr>
                    ) : safeProposalsList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-xl py-xxl text-center text-on-surface-variant font-body-md">No proposals found. Create your first one above!</td>
                      </tr>
                    ) : (
                      safeProposalsList.map(p => (
                        <tr 
                          key={p.id} 
                          onClick={() => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=5`)}
                          className="hover:bg-surface-container-lowest transition-colors cursor-pointer group"
                        >
                          <td className="px-xl py-lg">
                            <div className="font-body-md font-bold text-on-surface group-hover:text-primary transition-colors">{p.name || 'Untitled Proposal'}</div>
                          </td>
                          <td className="px-xl py-lg font-body-md text-on-surface">{p.client_name || p.client || '—'}</td>
                          <td className="px-xl py-lg font-body-md text-on-surface-variant">{p.destination || '—'}</td>
                          <td className="px-xl py-lg">
                            <StatusPill status={p.status} />
                          </td>
                          <td className="px-xl py-lg font-body-md text-on-surface-variant text-xs">
                            {p.date || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="bg-surface border border-outline-variant rounded-2xl p-xl">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface m-0 mb-lg flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-[20px]">timeline</span>
                Recent Activity
              </h3>
              <div className="space-y-md">
                {recentActivity.map((a, i) => (
                  <div key={a.id || i} className="flex items-start gap-md p-md bg-surface-container-lowest rounded-xl">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">{a.type || 'sync'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body-md text-sm font-bold text-on-surface m-0">{a.title}</p>
                      <p className="text-xs text-on-surface-variant m-0 mt-0.5 truncate">{a.detail}</p>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0">{a.when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

      </div>

      {/* Enlarge Proposals View Modal */}
      {proposalsEnlarged && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-md sm:p-xl animate-fade-in" onClick={() => setProposalsEnlarged(false)}>
          <div className="bg-surface border border-outline-variant w-full max-w-5xl h-[85vh] rounded-[32px] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-xl py-lg bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between gap-md shrink-0">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">folder_open</span>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-on-surface m-0">All Client Proposals</h3>
                  <p className="text-xs text-on-surface-variant m-0 mt-0.5">Showing {filteredProposals.length} of {safeProposalsList.length} proposals</p>
                </div>
              </div>
              
              <div className="flex items-center gap-md">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search proposals, clients..."
                    className="pl-10 pr-4 py-2 text-sm bg-surface rounded-xl border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-64"
                  />
                </div>
                <button 
                  onClick={() => setProposalsEnlarged(false)}
                  className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-all border border-outline-variant shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-xl">
              {filteredProposals.length === 0 ? (
                <div className="py-xxl text-center font-body-md text-on-surface-variant">No matching proposals found.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                    <tr className="border-b border-outline-variant">
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Proposal Name</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Client</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Destination</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                      <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filteredProposals.map(p => (
                      <tr 
                        key={p.id} 
                        onClick={() => { setProposalsEnlarged(false); navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=5`); }}
                        className="hover:bg-surface-container-lowest transition-colors cursor-pointer group"
                      >
                        <td className="px-xl py-lg">
                          <div className="font-body-md font-bold text-on-surface group-hover:text-primary transition-colors">{p.name || 'Untitled Proposal'}</div>
                        </td>
                        <td className="px-xl py-lg font-body-md text-on-surface">{p.client_name || p.client || '—'}</td>
                        <td className="px-xl py-lg font-body-md text-on-surface-variant">{p.destination || '—'}</td>
                        <td className="px-xl py-lg">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-xl py-lg font-body-md text-on-surface-variant text-xs">
                          {p.date || '—'}
                        </td>
                        <td className="px-xl py-lg text-right" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => { setProposalsEnlarged(false); navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=8`); }}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Open Preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Destinations Analytics Modal */}
      {showDestModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-md sm:p-xl animate-fade-in" onClick={() => setShowDestModal(false)}>
          <div className="bg-surface border border-outline-variant rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-xl border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">location_on</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-xl font-bold text-on-surface m-0">Destinations Generation Breakdown</h3>
                  <p className="text-xs text-on-surface-variant m-0 mt-0.5">Track proposal generation, PDF downloads, and client approvals by destination</p>
                </div>
              </div>
              <button onClick={() => setShowDestModal(false)} className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-xl overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-label-sm text-[11px] uppercase tracking-wider">
                      <th className="pb-3 pr-4 font-bold">Destination</th>
                      <th className="pb-3 px-4 font-bold text-center">PDF Generated</th>
                      <th className="pb-3 px-4 font-bold text-center">WhatsApp Shared</th>
                      <th className="pb-3 px-4 font-bold text-center">Gmail Shared</th>
                      <th className="pb-3 px-4 font-bold text-center text-teal-600 dark:text-teal-400">Approvals</th>
                      <th className="pb-3 px-4 font-bold text-center text-rose-600 dark:text-rose-400">Modifications</th>
                      <th className="pb-3 pl-4 font-bold text-right">Total Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60 text-sm font-medium">
                    {destinationsListComputed.length > 0 ? (
                      destinationsListComputed.map((d, i) => (
                        <tr key={d.name} className="hover:bg-surface-container-lowest transition-colors">
                          <td className="py-3.5 pr-4 font-bold text-on-surface flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-black">{i + 1}</span>
                            {d.name}
                          </td>
                          <td className="py-3.5 px-4 text-center font-display text-base">{d.pdf}</td>
                          <td className="py-3.5 px-4 text-center font-display text-base">{d.whatsapp}</td>
                          <td className="py-3.5 px-4 text-center font-display text-base">{d.email}</td>
                          <td className="py-3.5 px-4 text-center font-display text-base font-bold text-teal-600 dark:text-teal-400">{d.approvals}</td>
                          <td className="py-3.5 px-4 text-center font-display text-base font-bold text-rose-600 dark:text-rose-400">{d.modifications}</td>
                          <td className="py-3.5 pl-4 text-right font-display text-lg font-black text-primary">{d.totalGenerated}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-on-surface-variant font-body-sm">No destination data recorded yet. Generate and share some proposals to see analytics here.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

function StatCard({ title, value, icon, onClick }) {
  return (
    <div onClick={onClick} className={`bg-surface border border-outline-variant p-xl rounded-2xl flex flex-col justify-between h-36 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/50 transition-all hover:-translate-y-1' : ''}`}>
      <div className="flex items-center justify-between pointer-events-none">
        <p className="font-label-sm text-[11px] font-bold text-on-surface-variant uppercase tracking-widest m-0">{title}</p>
        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      <h3 className="font-display text-[40px] leading-none text-on-surface m-0 pointer-events-none">{value}</h3>
    </div>
  );
}

function MiniStatCard({ title, value, subtitle, icon, color, isText, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-surface border border-outline-variant p-lg rounded-2xl flex flex-col justify-between shadow-sm min-h-[110px] transition-all ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:bg-surface-container-lowest active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-center justify-between mb-sm">
        <p className="font-label-sm text-[10px] font-black text-on-surface-variant uppercase tracking-widest m-0">{title}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      <div>
        <h4 className={`font-display m-0 text-on-surface ${isText ? 'text-lg font-bold truncate' : 'text-2xl font-black'}`}>{value}</h4>
        {subtitle && <p className="text-[11px] font-medium text-on-surface-variant mt-0.5 m-0 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const norm = (status || '').toUpperCase();
  let classes = 'bg-surface-container text-on-surface-variant';
  
  if (norm === 'ACCEPTED') {
    classes = 'bg-primary-container text-on-primary-container';
  } else if (norm === 'SENT') {
    classes = 'bg-on-surface text-surface';
  } else if (norm === 'DRAFT') {
    classes = 'bg-surface-container-highest text-on-surface';
  }

  return (
    <span className={`px-md py-1 text-[10px] font-black rounded-full uppercase tracking-widest inline-block ${classes}`}>
      {norm || 'DRAFT'}
    </span>
  );
}
