import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext.jsx';

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('voyanta_admin_access_token') || sessionStorage.getItem('voyanta_admin_access_token') || '';
  });

  // Admin Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'user_management'
  const [kpis, setKpis] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add Admin Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const [roleUpdating, setRoleUpdating] = useState({});
  const [showSubBreakdownModal, setShowSubBreakdownModal] = useState(false);

  const loadData = async (tokenToUse = adminToken) => {
    if (!tokenToUse) return;
    setLoading(true);
    setError(null);
    try {
      // Also try standard user token if available
      const stdToken = localStorage.getItem('voyanta_access_token') || sessionStorage.getItem('voyanta_access_token');
      const headers = {
        Authorization: `Bearer ${tokenToUse || stdToken}`
      };

      const [summaryRes, usersRes] = await Promise.all([
        fetch('/api/admin/analytics/summary', { headers }),
        fetch('/api/admin/users', { headers })
      ]);

      if (!summaryRes.ok) {
        if (summaryRes.status === 403 || summaryRes.status === 401) {
          setAdminToken('');
          localStorage.removeItem('voyanta_admin_access_token');
          throw new Error('Access Denied: Please log in with an authorized Platform Admin email & password.');
        }
        throw new Error(`Failed to load summary: ${summaryRes.statusText}`);
      }

      const summaryData = await summaryRes.json();
      setKpis(summaryData.kpis);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const serverUsers = usersData.users || [];
        const cachedUsers = JSON.parse(localStorage.getItem('voyanta_admin_users_cache') || '[]');
        
        // Merge server and local created admins
        const merged = [...serverUsers];
        for (const cu of cachedUsers) {
          if (!merged.some(u => u.email.toLowerCase() === cu.email.toLowerCase())) {
            merged.push(cu);
          }
        }
        setUsers(merged);
        localStorage.setItem('voyanta_admin_users_cache', JSON.stringify(merged));
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      const cachedUsers = JSON.parse(localStorage.getItem('voyanta_admin_users_cache') || '[]');
      if (cachedUsers.length > 0) setUsers(cachedUsers);
      setError(err.message || 'Failed to load executive admin analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadData(adminToken);
    }
  }, [adminToken]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter both Email and Password');
      return;
    }
    setLoggingIn(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid admin credentials');
      }

      toast.success(`Welcome back, ${data.user?.full_name || 'Admin'}!`);
      const token = data.token;
      setAdminToken(token);
      localStorage.setItem('voyanta_admin_access_token', token);
      loadData(token);
    } catch (err) {
      setError(err.message || 'Admin authentication failed');
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    localStorage.removeItem('voyanta_admin_access_token');
    toast.info('Logged out from Super Admin session');
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword) {
      toast.error('Email and Password are required for new Admin');
      return;
    }
    setAddingAdmin(true);
    try {
      const tokenToUse = adminToken || localStorage.getItem('voyanta_access_token');
      const res = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          full_name: newAdminName || 'Platform Admin'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add admin');

      const createdUser = data.user || {
        id: crypto.randomUUID(),
        email: newAdminEmail.trim().toLowerCase(),
        full_name: newAdminName || 'Platform Admin',
        role: 'admin',
        created_at: new Date().toISOString()
      };

      setUsers(prev => {
        const next = [createdUser, ...prev.filter(u => u.email.toLowerCase() !== createdUser.email.toLowerCase())];
        localStorage.setItem('voyanta_admin_users_cache', JSON.stringify(next));
        return next;
      });

      toast.success(data.message || 'Admin added successfully');
      setShowAddModal(false);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
      loadData(tokenToUse);
    } catch (err) {
      toast.error(err.message || 'Failed to add admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to remove Admin access for ${userEmail}?`)) return;

    setRoleUpdating(prev => ({ ...prev, [userId]: true }));
    try {
      const tokenToUse = adminToken || localStorage.getItem('voyanta_access_token');
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenToUse}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove admin');

      setUsers(prev => {
        const next = prev.filter(u => u.id !== userId && u.email.toLowerCase() !== userEmail.toLowerCase());
        localStorage.setItem('voyanta_admin_users_cache', JSON.stringify(next));
        return next;
      });

      toast.success(`Removed Admin access for ${userEmail}`);
      loadData(tokenToUse);
    } catch (err) {
      toast.error(err.message || 'Failed to remove admin');
    } finally {
      setRoleUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  // If not authenticated as Admin, show inline Admin Access Barrier
  if (!adminToken && !kpis) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-md text-on-surface">
        <div className="w-full max-w-md bg-surface-container-lowest p-xl rounded-2xl shadow-2xl border border-outline-variant/80 space-y-lg">
          <div className="text-center space-y-xs">
            <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center rounded-2xl mx-auto mb-sm border border-primary/20">
              <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            </div>
            <h2 className="font-headline-md text-2xl font-black text-primary m-0">Platform Super Admin</h2>
            <p className="text-xs text-on-surface-variant">Enter your authorized email & password to access executive analytics.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-md rounded-xl text-xs flex items-start gap-xs">
              <span className="material-symbols-outlined text-base shrink-0 text-red-600">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-md">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="admin@voyanta.com"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface-container border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface-container border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 bg-primary text-on-primary hover:bg-primary-hover rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-xs cursor-pointer disabled:opacity-50"
            >
              {loggingIn ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  <span>Verifying Credentials…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  <span>Unlock Admin Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const signups = kpis?.signups || {};
  const subs = kpis?.subscriptions || {};
  const channels = kpis?.channels || {};
  const engagement = kpis?.engagement || {};

  const totalActions = channels.total_actions || 1;
  const pdfPct = Math.round((channels.pdf_downloads / totalActions) * 100) || 0;
  const waPct = Math.round((channels.whatsapp_shares / totalActions) * 100) || 0;
  const emailPct = Math.round((channels.email_shares / totalActions) * 100) || 0;
  const webPct = Math.round((channels.web_views / totalActions) * 100) || 0;

  return (
    <div className="min-h-screen bg-surface p-lg space-y-xl max-w-7xl mx-auto text-on-surface" data-testid="admin-analytics-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant/60 pb-md">
        <div>
          <h2 className="font-headline-md text-primary font-bold flex items-center gap-xs">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            Platform Super Admin Operations
          </h2>
          <p className="text-xs text-on-surface-variant">
            Platform traffic, subscription conversions, channel proposal shares, and platform admin access.
          </p>
        </div>

        <div className="flex items-center gap-md flex-wrap">
          {/* Tab Switcher */}
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/60">
            <button
              onClick={() => setActiveTab('kpis')}
              className={`px-md py-xs rounded-lg text-xs font-bold transition-all flex items-center gap-xs cursor-pointer ${
                activeTab === 'kpis' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">analytics</span>
              Executive KPIs
            </button>
            <button
              onClick={() => setActiveTab('user_management')}
              className={`px-md py-xs rounded-lg text-xs font-bold transition-all flex items-center gap-xs cursor-pointer ${
                activeTab === 'user_management' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
              Manage Admins ({users.filter(u => u.role === 'admin' || u.role === 'owner').length})
            </button>
          </div>

          <button
            onClick={handleAdminLogout}
            className="px-md py-xs border border-outline-variant/80 rounded-xl text-xs font-bold hover:bg-red-50 text-red-700 transition-all flex items-center gap-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Exit Admin
          </button>
        </div>
      </div>

      {activeTab === 'kpis' ? (
        <div className="space-y-xl">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {/* Today's Signups */}
            <div className="glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-xs">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Today's Signups</span>
              <div className="text-3xl font-extrabold text-primary flex items-baseline gap-xs">
                {signups.today || 0}
                <span className="text-xs font-normal text-on-surface-variant">({signups.seven_days || 0} this week)</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">Total registered users: {signups.total_users || 0}</p>
            </div>

            {/* Active Free Trials */}
            <div 
              onClick={() => setShowSubBreakdownModal(true)}
              className="glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-xs cursor-pointer hover:border-amber-500/60 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Free Trial Users</span>
                <span className="material-symbols-outlined text-xs text-amber-600 group-hover:translate-x-0.5 transition-transform">open_in_new</span>
              </div>
              <div className="text-3xl font-extrabold text-amber-600">
                {subs.free_trial || 0}
              </div>
              <p className="text-[11px] text-on-surface-variant">14-day trial active subscriptions →</p>
            </div>

            {/* Active Paid Users & MRR */}
            <div 
              onClick={() => setShowSubBreakdownModal(true)}
              className="glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-xs cursor-pointer hover:border-emerald-500/60 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Active Paid Subscribers</span>
                <span className="material-symbols-outlined text-xs text-emerald-600 group-hover:translate-x-0.5 transition-transform">open_in_new</span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 flex items-baseline gap-xs">
                {subs.paid_subscribers || 0}
                <span className="text-xs font-bold text-emerald-700">₹{(subs.estimated_mrr_inr || 0).toLocaleString()}/mo MRR</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">Pro: {subs.professional || 0} · Pro+: {subs.professional_plus || 0} · Ent: {subs.enterprise || 0} →</p>
            </div>

            {/* Proposal Exports & Shares */}
            <div className="glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-xs">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Total Proposal Actions</span>
              <div className="text-3xl font-extrabold text-blue-600">
                {channels.total_actions || 0}
              </div>
              <p className="text-[11px] text-on-surface-variant">Approvals: {channels.client_approvals || 0} · Edits: {channels.client_modifications || 0}</p>
            </div>
          </div>

          {/* Channel Breakdown Charts & Agent Engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
            {/* Channel Breakdown */}
            <div className="lg:col-span-7 glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-md">
              <h3 className="font-headline-sm text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">share</span>
                Proposal Distribution by Channel
              </h3>

              <div className="space-y-md pt-xs">
                {/* PDF */}
                <div className="space-y-xs">
                  <div className="flex justify-between text-xs font-medium">
                    <span>PDF Downloads</span>
                    <span className="font-bold text-primary">{channels.pdf_downloads || 0} ({pdfPct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pdfPct}%` }}></div>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-xs">
                  <div className="flex justify-between text-xs font-medium">
                    <span>WhatsApp Direct Shares</span>
                    <span className="font-bold text-emerald-600">{channels.whatsapp_shares || 0} ({waPct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${waPct}%` }}></div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-xs">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Gmail / Email Shares</span>
                    <span className="font-bold text-amber-600">{channels.email_shares || 0} ({emailPct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${emailPct}%` }}></div>
                  </div>
                </div>

                {/* Web Views */}
                <div className="space-y-xs">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Public Web Views (Client Link Opens)</span>
                    <span className="font-bold text-purple-600">{channels.web_views || 0} ({webPct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${webPct}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Engagement & Usage */}
            <div className="lg:col-span-5 glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-md">
              <h3 className="font-headline-sm text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">group</span>
                Agent Engagement Metrics
              </h3>

              <div className="divide-y divide-outline-variant/40 text-xs">
                <div className="py-sm flex justify-between items-center">
                  <span className="text-on-surface-variant">Monthly Active Agents (MAU)</span>
                  <span className="font-bold text-on-surface">{engagement.monthly_active_agents || 0}</span>
                </div>
                <div className="py-sm flex justify-between items-center">
                  <span className="text-on-surface-variant">Total Proposals Generated</span>
                  <span className="font-bold text-on-surface">{engagement.total_proposals || 0}</span>
                </div>
                <div className="py-sm flex justify-between items-center">
                  <span className="text-on-surface-variant">Avg Proposals / Agent</span>
                  <span className="font-bold text-primary">{engagement.avg_proposals_per_agent || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Manage Admins Tab */
        <div className="glass-card p-lg rounded-2xl border border-outline-variant/60 space-y-md">
          <div className="flex justify-between items-center flex-wrap gap-md">
            <div>
              <h3 className="font-headline-sm text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Platform Admin Management
              </h3>
              <p className="text-xs text-on-surface-variant">Add new platform admin credentials or remove existing admin privileges.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-md py-xs bg-primary text-on-primary hover:bg-primary-hover rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add New Admin
            </button>
          </div>

          {/* Admin User Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/60 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="py-md px-sm">Admin Email</th>
                  <th className="py-md px-sm">Full Name</th>
                  <th className="py-md px-sm">Role</th>
                  <th className="py-md px-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-md px-sm font-bold text-on-surface">
                      {u.email}
                    </td>
                    <td className="py-md px-sm text-on-surface-variant">
                      {u.full_name || 'Platform Admin'}
                    </td>
                    <td className="py-md px-sm">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                        u.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'admin' ? 'bg-primary/10 text-primary' :
                        'bg-surface-container text-on-surface-variant'
                      }`}>
                        {u.role || 'agent'}
                      </span>
                    </td>
                    <td className="py-md px-sm text-right">
                      {(u.role === 'admin' || u.role === 'owner') && u.role !== 'owner' ? (
                        <button
                          type="button"
                          disabled={roleUpdating[u.id]}
                          onClick={() => handleRemoveAdmin(u.id, u.email)}
                          className="px-md py-1 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant italic">Platform Owner</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-xl shadow-2xl border border-outline-variant space-y-md">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-sm text-lg font-bold text-primary">Add Platform Admin</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-md">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Admin Email (Gmail ID)</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  placeholder="admin.email@gmail.com"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  placeholder="Set admin password..."
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Admin Full Name</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={e => setNewAdminName(e.target.value)}
                  placeholder="e.g. Platform Manager"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-surface-container border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="pt-xs flex justify-end gap-xs">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-md py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingAdmin}
                  className="px-lg py-2 bg-primary text-on-primary hover:bg-primary-hover rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {addingAdmin ? 'Adding Admin...' : 'Save & Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Subscription Tier Breakdown Modal */}
      {showSubBreakdownModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl p-xl shadow-2xl border border-outline-variant space-y-md">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-sm">
              <h3 className="font-headline-sm text-base font-bold text-primary flex items-center gap-xs">
                <span className="material-symbols-outlined text-emerald-600 text-xl">payments</span>
                Subscription Tier Breakdown
              </h3>
              <button 
                onClick={() => setShowSubBreakdownModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-sm">
              {/* Free Trial */}
              <div className="p-md rounded-xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-amber-900">14-Day Free Trial</div>
                  <div className="text-xs text-amber-700/80">Full features active for new travel advisors</div>
                </div>
                <div className="text-xl font-extrabold text-amber-700">{subs.free_trial || 0} <span className="text-xs font-normal">users</span></div>
              </div>

              {/* Starter Plan */}
              <div className="p-md rounded-xl bg-surface-container border border-outline-variant/60 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-on-surface">Starter Plan</div>
                  <div className="text-xs text-on-surface-variant">₹0 / month — Pay per proposal export</div>
                </div>
                <div className="text-xl font-bold text-on-surface">{subs.starter || 0} <span className="text-xs font-normal">users</span></div>
              </div>

              {/* Professional Plan */}
              <div className="p-md rounded-xl bg-blue-500/10 border border-blue-500/20 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-blue-900">Professional Plan</div>
                  <div className="text-xs text-blue-700">₹2,999 / month — Unlimited PDF & WhatsApp proposals</div>
                </div>
                <div className="text-xl font-bold text-blue-700">{subs.professional || 0} <span className="text-xs font-normal">users</span></div>
              </div>

              {/* Professional Plus Plan */}
              <div className="p-md rounded-xl bg-purple-500/10 border border-purple-500/20 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-purple-900">Professional Plus Plan</div>
                  <div className="text-xs text-purple-700">₹4,999 / month — Advanced VI AI, Multi-agent & Vault RAG</div>
                </div>
                <div className="text-xl font-bold text-purple-700">{subs.professional_plus || 0} <span className="text-xs font-normal">users</span></div>
              </div>

              {/* Enterprise Plan */}
              <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-emerald-900">Enterprise Plan</div>
                  <div className="text-xs text-emerald-700">₹7,999 / month — Multi-agent teams, custom branding & RBAC</div>
                </div>
                <div className="text-xl font-bold text-emerald-700">{subs.enterprise || 0} <span className="text-xs font-normal">users</span></div>
              </div>
            </div>

            <div className="pt-sm border-t border-outline-variant flex justify-between items-center">
              <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Estimated MRR</span>
              <span className="text-lg font-black text-emerald-600">₹{(subs.estimated_mrr_inr || 0).toLocaleString()} / mo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
