import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useToast } from '../context/ToastContext.jsx';
import UpgradePlanModal from './billing/UpgradePlanModal.jsx';
import { useVaultStore } from '../store/vaultStore.js';

const navItems = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { path: '/vault', icon: 'auto_awesome', label: 'MY VAULT', badge: 'AI & RAG' },
  { path: '/proposals/wizard', icon: 'add_box', label: 'New Proposal' },
  { path: '/proposals', icon: 'folder_open', label: 'Proposals' },
  { path: '/crm', icon: 'groups', label: 'Clients (CRM)' },
  { path: '/contacts', icon: 'contacts', label: 'Contacts' },
  { path: '/invoices', icon: 'account_balance_wallet', label: 'Invoices & Billing' },
  { path: '/templates', icon: 'description', label: 'Templates' },
  { path: '/flights', icon: 'flight', label: 'Flights' },
  { path: '/library', icon: 'library_books', label: 'Library' },
  { path: '/cost-calculator', icon: 'calculate', label: 'Cost Calculator' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isDemo, signOut, hasAcceptedTerms, acceptTerms } = useAuthStore();
  const { isProcessing, batchProgress } = useVaultStore();

  const [acceptModalChecked, setAcceptModalChecked] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);

  const isDashboard = location.pathname === '/dashboard';

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    const nextDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    setIsDark(nextDark);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const notifRef = useRef(null);
  const helpRef = useRef(null);

  const userEmail = user?.email || 'user@agency.com';
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(14);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialLocked, setTrialLocked] = useState(false);
  const [upiReminder, setUpiReminder] = useState(false);

  useEffect(() => {
    const payMethod = localStorage.getItem('voyanta_payment_method') || '';
    if (payMethod === 'upi' || payMethod === 'bank_transfer') {
      setUpiReminder(true);
    }

    let startTime;
    if (user && !isDemo && user.created_at) {
      startTime = new Date(user.created_at).getTime();
    } else {
      const storedStart = localStorage.getItem(`voyanta_trial_start_${userEmail}`);
      if (!storedStart) {
        startTime = Date.now();
        localStorage.setItem(`voyanta_trial_start_${userEmail}`, startTime.toString());
      } else {
        startTime = parseInt(storedStart, 10);
      }
    }
    const daysElapsed = Math.floor((Date.now() - startTime) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 14 - daysElapsed);
    setTrialDaysRemaining(remaining);
    setTrialExpired(daysElapsed >= 14);
    setTrialLocked(daysElapsed >= 30);
  }, [user, isDemo, userEmail]);

  useEffect(() => {
    if (user) {
      const pendingPlan = localStorage.getItem('voyanta_pending_subscription_plan');
      if (pendingPlan) {
        localStorage.removeItem('voyanta_pending_subscription_plan');
        setUpgradeModalOpen(true);
      }
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
      if (helpRef.current && !helpRef.current.contains(event.target)) setShowHelp(false);
    };
    const handleScroll = (event) => {
      if (showNotifications && notifRef.current && notifRef.current.contains(event.target)) return;
      if (showHelp && helpRef.current && helpRef.current.contains(event.target)) return;
      if (showNotifications) setShowNotifications(false);
      if (showHelp) setShowHelp(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showNotifications, showHelp]);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadRealNotifications = () => {
      let items = [];
      // Check stored notification logs
      try {
        const storedLogs = JSON.parse(localStorage.getItem('voyanta_notifications') || '[]');
        if (Array.isArray(storedLogs)) {
          items.push(...storedLogs);
        }
        const storedLogsList = JSON.parse(localStorage.getItem('voyanta_notifications_list') || '[]');
        if (Array.isArray(storedLogsList)) {
          items.push(...storedLogsList);
        }
      } catch { }

      // Read real activity logs
      try {
        const actLogs = JSON.parse(localStorage.getItem('voyanta_activity_logs') || '[]');
        if (Array.isArray(actLogs)) {
          actLogs.forEach(log => {
            items.push({
              id: `act_log_${log.id}`,
              icon: log.type === 'approval' ? 'check_circle' : log.type === 'modification' ? 'edit_note' : log.type === 'pdf' ? 'picture_as_pdf' : log.type === 'invoice' ? 'receipt' : log.type === 'crm' ? 'person_add' : 'sync',
              title: log.type ? log.type.toUpperCase() : 'Activity',
              desc: log.description || '',
              time: log.timestamp || log.created_at || 'Just now',
              unread: true,
              ts: new Date(log.timestamp || log.created_at || Date.now()).getTime()
            });
          });
        }
      } catch { }

      // Check real proposals
      try {
        const props = JSON.parse(localStorage.getItem('voyanta_proposals') || '[]');
        if (Array.isArray(props)) {
          props.forEach(p => {
            if (p.status === 'Sent' || p.status === 'Proposal Sent') {
              items.push({
                id: `prop_sent_${p.id}`,
                icon: 'mail',
                title: 'Proposal Sent',
                desc: `Sent '${p.title || p.destination || 'Proposal'}' to ${p.client_name || p.client || 'client'}.`,
                time: p.sent_at || p.created_at || 'Recent',
                unread: true,
                ts: new Date(p.sent_at || p.created_at || Date.now()).getTime()
              });
            } else if (p.status === 'Approved' || p.status === 'Accepted' || p.status === 'Booked') {
              items.push({
                id: `prop_app_${p.id}`,
                icon: 'check_circle',
                title: 'Proposal Approved',
                desc: `'${p.title || p.destination || 'Proposal'}' was approved by ${p.client_name || p.client || 'client'}.`,
                time: p.updated_at || p.created_at || 'Recent',
                unread: true,
                ts: new Date(p.updated_at || p.created_at || Date.now()).getTime()
              });
            } else if (p.status === 'Modification Requested' || p.status === 'Changes Requested') {
              items.push({
                id: `prop_mod_${p.id}`,
                icon: 'edit_note',
                title: 'Modification Request',
                desc: `${p.client_name || 'Client'} requested changes for '${p.title || p.destination || 'Proposal'}'.`,
                time: p.updated_at || p.created_at || 'Recent',
                unread: true,
                ts: new Date(p.updated_at || p.created_at || Date.now()).getTime()
              });
            }
          });
        }
      } catch { }

      // Check real invoices & payments
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('voyanta_invoices_data_')) {
            const invs = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(invs)) {
              invs.forEach(inv => {
                items.push({
                  id: `inv_gen_${inv.id}`,
                  icon: 'receipt_long',
                  title: 'Invoice Generated',
                  desc: `Generated invoice #${inv.invoice_number} for ${inv.client_name || 'client'}.`,
                  time: inv.invoice_date || inv.created_at || 'Recent',
                  unread: false,
                  ts: new Date(inv.invoice_date || inv.created_at || Date.now()).getTime()
                });
                if (inv.status === 'Paid' || inv.status === 'Partially Paid' || Number(inv.paid_amount) > 0) {
                  items.push({
                    id: `inv_paid_${inv.id}`,
                    icon: 'payments',
                    title: 'Payment Received',
                    desc: `Received payment (${inv.currency || 'INR'} ${inv.paid_amount || inv.total_amount || 0}) for invoice #${inv.invoice_number} from ${inv.client_name || 'client'}.`,
                    time: inv.updated_at || inv.invoice_date || 'Recent',
                    unread: true,
                    ts: new Date(inv.updated_at || inv.invoice_date || Date.now()).getTime()
                  });
                }
              });
            }
          }
        }
      } catch { }

      // Check CRM contacts added
      try {
        const crmKeys = ['voyanta_crm_clients'];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('voyanta_clients_data_')) crmKeys.push(k);
        }
        crmKeys.forEach(key => {
          const clients = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(clients)) {
            clients.forEach(c => {
              if (c.name) {
                items.push({
                  id: `crm_add_${c.id || c.name}`,
                  icon: 'person_add',
                  title: 'Contact Added',
                  desc: `Added contact '${c.name}' (${c.email || c.phone || 'CRM'}) to client directory.`,
                  time: c.created_at || 'Recent',
                  unread: false,
                  ts: new Date(c.created_at || Date.now()).getTime()
                });
              }
            });
          }
        });
      } catch { }

      // Deduplicate by ID and sort by newest first
      const seen = new Set();
      const uniqueItems = [];
      items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      items.forEach(it => {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          uniqueItems.push(it);
        }
      });

      setNotifications(uniqueItems.slice(0, 20));
    };

    loadRealNotifications();
    window.addEventListener('voyanta:notifications-updated', loadRealNotifications);
    window.addEventListener('voyanta:activity-log-updated', loadRealNotifications);
    window.addEventListener('voyanta:proposals-updated', loadRealNotifications);
    window.addEventListener('voyanta:invoices-updated', loadRealNotifications);
    window.addEventListener('voyanta:clients-updated', loadRealNotifications);
    window.addEventListener('storage', loadRealNotifications);
    return () => {
      window.removeEventListener('voyanta:notifications-updated', loadRealNotifications);
      window.removeEventListener('voyanta:activity-log-updated', loadRealNotifications);
      window.removeEventListener('voyanta:proposals-updated', loadRealNotifications);
      window.removeEventListener('voyanta:invoices-updated', loadRealNotifications);
      window.removeEventListener('voyanta:clients-updated', loadRealNotifications);
      window.removeEventListener('storage', loadRealNotifications);
    };
  }, []);

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, unread: false }));
      try { localStorage.setItem('voyanta_notifications', JSON.stringify(updated)); } catch { }
      return updated;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 flex flex-col py-lg space-y-xs overflow-y-auto bg-surface border-r border-outline-variant z-50">
        <div className="px-lg mb-xl">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg">
              <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>travel_explore</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-black text-primary m-0 leading-tight">Voyanta</h1>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest m-0">Travel Concierge</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-xs px-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-md py-md px-lg rounded-r-lg transition-all duration-200 ${isActive
                  ? 'bg-surface-container-high text-primary font-semibold border-l-4 border-primary scale-[0.98]'
                  : 'text-on-surface-variant hover:bg-surface-container-low border-l-4 border-transparent'
                }`
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-md text-label-md flex-1">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-primary/15 text-primary border border-primary/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>


      </aside>

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Dynamic Top Banner */}
        {upiReminder && (
          <div className="flex-shrink-0 bg-amber-600 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md z-50 text-xs font-semibold">
            <span>🔔 Upcoming UPI / Bank Renewal: Your subscription renews in 4 days. Make payment now to ensure continuous access.</span>
            <button onClick={() => setUpgradeModalOpen(true)} className="px-3 py-1 bg-white text-amber-900 font-bold rounded-lg border-none cursor-pointer">Pay Now</button>
          </div>
        )}
        {!upiReminder && (
          <div className={`flex-shrink-0 ${trialExpired ? 'bg-error text-white' : 'bg-gradient-to-r from-primary/90 via-emerald-600 to-primary text-white'} px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md z-50 text-xs`}>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold uppercase text-[10px] tracking-wider">
                {trialExpired ? 'Trial Ended' : 'Free Trial'}
              </span>
              <span className="font-semibold">
                {trialExpired
                  ? '⚠️ Your 14-Day Free Trial has ended. Subscribe to continue creating and exporting proposals.'
                  : `🎁 14-Day Full Access Free Trial Active • ${trialDaysRemaining} Days Remaining (No credit card required)`}
              </span>
            </div>
            <button
              onClick={() => setUpgradeModalOpen(true)}
              className="px-3 py-1 bg-white text-primary hover:bg-white/90 font-bold rounded-lg shadow-sm transition-all text-xs border-none cursor-pointer"
            >
              Upgrade Plan (Save 20% Yearly)
            </button>
          </div>
        )}

        {/* Top Navigation Bar */}
        {isDashboard && (
          <header className="flex-shrink-0 flex justify-between items-center w-full px-lg py-md bg-surface shadow-sm z-40">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[24px]">dashboard</span>
              <h2 className="font-headline-md text-lg font-bold text-on-surface m-0 tracking-tight">Agent Dashboard</h2>
            </div>
            <div className="flex items-center gap-md ml-lg relative">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-sm text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                title={isDark ? "Switch to Bright Mode" : "Switch to Dark Mode"}
              >
                <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div ref={notifRef} className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-sm text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors relative border-none bg-transparent cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">notifications</span>
                  {notifications.some(n => n.unread) && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full animate-pulse"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-sm w-96 bg-surface border border-outline-variant rounded-xl shadow-xl z-50 py-sm overflow-hidden">
                    <div className="px-lg py-sm border-b border-outline-variant flex justify-between items-center">
                      <h4 className="font-display text-sm font-bold text-on-surface m-0">Recent Activity</h4>
                      <button onClick={markAllRead} className="text-[11px] font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer">Mark all read</button>
                    </div>
                    <div className="divide-y divide-outline-variant max-h-[300px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-on-surface-variant flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">notifications_off</span>
                          <p className="font-bold text-xs text-on-surface m-0">No Recent Activity</p>
                          <p className="text-[11px] text-on-surface-variant m-0 max-w-xs">Your notifications will appear here as proposals are sent, approved, invoices generated, payments received, or contacts added.</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`flex items-start gap-md p-md hover:bg-surface-container-lowest transition-colors ${n.unread ? 'bg-surface-container-low/20' : ''}`}>
                            <div className="w-8 h-8 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0 text-on-primary-container">
                              <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-body-md text-xs font-semibold text-on-surface m-0">{n.title}</p>
                              <p className="font-body-md text-xs text-on-surface-variant m-0 mt-0.5 leading-snug">{n.desc}</p>
                              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider m-0 mt-xs">
                                {typeof n.time === 'string' && (n.time.includes('ago') || n.time.includes('Yesterday') || n.time.includes('Recent')) ? n.time : new Date(n.time || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                            {n.unread && <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div ref={helpRef} className="relative">
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="p-sm text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">help</span>
                </button>
                {showHelp && (
                  <div className="absolute right-0 top-full mt-sm w-64 bg-surface border border-outline-variant rounded-xl shadow-xl z-50 p-lg">
                    <h4 className="font-headline-sm text-sm font-bold text-on-surface mb-sm">Voyanta Support</h4>
                    <p className="font-body-md text-xs text-on-surface-variant mb-md leading-relaxed">Need help configuring your account or creating a proposal? Our concierge team is here for you.</p>
                    <div className="space-y-xs">
                      <div className="flex items-center gap-sm text-sm">
                        <span className="material-symbols-outlined text-[18px] text-primary">mail</span>
                        <a href="mailto:support@voyanta.com" className="text-on-surface hover:text-primary transition-colors">support@voyanta.com</a>
                      </div>
                      <div className="flex items-center gap-sm text-sm">
                        <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                        <a href="tel:+1800VOYANTA" className="text-on-surface hover:text-primary transition-colors">+1-800-VOYANTA</a>
                      </div>
                      <div className="flex items-center gap-sm text-sm pt-2 border-t border-outline-variant mt-2">
                        <span className="material-symbols-outlined text-[18px] text-primary font-bold">menu_book</span>
                        <Link to="/how-to-use" className="text-primary hover:underline font-bold transition-colors">How to Use Guide</Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-xl pt-md">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>

      {trialLocked && !upgradeModalOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-surface border border-outline-variant max-w-lg w-full rounded-3xl p-8 text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">lock</span>
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-2">Subscription Required</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your 14-day Free Trial and grace period have expired. To unlock your proposals, client CRM, and AI Vault library, please subscribe to a Voyanta plan.
              </p>
            </div>
            <button
              onClick={() => setUpgradeModalOpen(true)}
              className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer border-none"
            >
              Choose a Plan & Unlock Now
            </button>
          </div>
        </div>
      )}

      <UpgradePlanModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        lockedItemName="Save 20% with Annual Subscription"
      />

      {!hasAcceptedTerms && user && !isDemo && (
        <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-md">
          <div className="bg-surface border border-outline-variant max-w-2xl w-full rounded-3xl p-xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative backdrop-blur-md">
            {/* Visual Brand Panel */}
            <div className="hidden md:flex md:w-1/3 bg-gradient-to-br from-primary via-primary-container to-secondary-container p-lg flex-col justify-between text-white rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none"></div>
              <div>
                <span className="material-symbols-outlined text-[32px] text-white">security</span>
                <h3 className="font-display text-lg font-black mt-md leading-snug">Privacy & Compliance</h3>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">Voyanta is committed to securing your agency and client data under the Digital Personal Data Protection (DPDP) Act, 2023.</p>
            </div>
            
            {/* Form & Content Panel */}
            <div className="flex-1 md:pl-xl py-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-xs text-xs font-bold text-primary uppercase tracking-widest mb-xs">
                  <span className="material-symbols-outlined text-[14px]">policy</span>
                  DPDP Act Consent Notice
                </div>
                <h2 className="font-display text-2xl font-bold text-on-surface mb-sm">Confirm Your Consent</h2>
                
                <p className="text-xs text-on-surface-variant leading-relaxed mb-md">
                  In compliance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>, we require your explicit consent to collect, store, and process your personal and operational data (including your name, email, contact info, IP address, and details parsed from uploaded supplier documents).
                </p>
                
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-md text-[11px] leading-relaxed text-on-surface-variant space-y-xs max-h-[160px] overflow-y-auto mb-md">
                  <p><strong>What we process:</strong> Account credentials (name, email), system interaction logs (IP address, browser profile), client profiles (contact lists), and document uploads (rates, flight paths, hotel bookings).</p>
                  <p><strong>Purposes:</strong> Generating travel itineraries, invoice administration, AI extractions, RAG search indices, and subscription billing.</p>
                  <p><strong>Rights:</strong> You retain the right to correct, complete, or request erasure of your data, or withdraw consent at any time via <a href="mailto:privacy@voyanta.in" className="text-primary underline">privacy@voyanta.in</a>.</p>
                  <p><strong>Security:</strong> All operations utilize encrypted isolated storage scoped by Agency ID. We never train public models on your data.</p>
                </div>
              </div>
              
              <div className="space-y-md">
                <div className="flex items-start gap-sm select-none">
                  <input
                    type="checkbox"
                    id="modalTermsAccepted"
                    checked={acceptModalChecked}
                    onChange={(e) => setAcceptModalChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary rounded cursor-pointer shrink-0"
                  />
                  <label htmlFor="modalTermsAccepted" className="text-xs text-on-surface-variant leading-normal cursor-pointer">
                    I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Privacy Policy</a>, and consent to the processing of my personal data.
                  </label>
                </div>
                
                <div className="flex gap-sm">
                  <button
                    onClick={handleSignOut}
                    className="flex-1 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-xl transition-all border border-outline-variant cursor-pointer text-xs"
                  >
                    Decline & Sign Out
                  </button>
                  <button
                    disabled={!acceptModalChecked || acceptingTerms}
                    onClick={async () => {
                      setAcceptingTerms(true);
                      try {
                        await acceptTerms(navigator.userAgent);
                        toast.success('Terms and Privacy consent successfully logged.');
                      } catch (err) {
                        toast.error(err.message || 'Failed to register terms acceptance');
                      } finally {
                        setAcceptingTerms(false);
                      }
                    }}
                    className="flex-1.5 py-3 bg-primary hover:opacity-95 text-white font-bold rounded-xl shadow-md transition-all border-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs"
                  >
                    {acceptingTerms ? 'Logging consent...' : 'Accept & Proceed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div 
          onClick={() => navigate('/vault')}
          className="fixed bottom-6 right-6 z-[99999] max-w-sm bg-surface/90 dark:bg-surface-container/95 border border-outline-variant/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md cursor-pointer hover:border-primary/50 hover:shadow-primary/5 transition-all flex items-center gap-3 select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold text-on-surface m-0 truncate">AI Vault Extracting</h5>
            <p className="text-[10px] text-on-surface-variant m-0 mt-0.5 truncate leading-snug">
              {batchProgress.currentFile} ({batchProgress.current}/{batchProgress.total})
            </p>
            <div className="w-full bg-outline-variant/35 rounded-full h-1 mt-1.5 overflow-hidden">
              <div 
                className="bg-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / (batchProgress.total || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/60 text-sm">chevron_right</span>
        </div>
      )}
    </div>
  );
}
