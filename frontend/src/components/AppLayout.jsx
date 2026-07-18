import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useToast } from '../context/ToastContext.jsx';
import UpgradePlanModal from './billing/UpgradePlanModal.jsx';

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
  const { user, isDemo, signOut } = useAuthStore();

  const isDashboard = location.pathname === '/dashboard';

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
    const handleScroll = () => {
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
      try {
        const storedLogs = JSON.parse(localStorage.getItem('voyanta_notifications') || '[]');
        if (Array.isArray(storedLogs)) {
          items.push(...storedLogs);
        }
      } catch {}

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
      } catch {}

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
      } catch {}

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
      } catch {}

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
    window.addEventListener('voyanta:proposals-updated', loadRealNotifications);
    window.addEventListener('voyanta:invoices-updated', loadRealNotifications);
    window.addEventListener('voyanta:clients-updated', loadRealNotifications);
    window.addEventListener('storage', loadRealNotifications);
    return () => {
      window.removeEventListener('voyanta:notifications-updated', loadRealNotifications);
      window.removeEventListener('voyanta:proposals-updated', loadRealNotifications);
      window.removeEventListener('voyanta:invoices-updated', loadRealNotifications);
      window.removeEventListener('voyanta:clients-updated', loadRealNotifications);
      window.removeEventListener('storage', loadRealNotifications);
    };
  }, []);

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, unread: false }));
      try { localStorage.setItem('voyanta_notifications', JSON.stringify(updated)); } catch {}
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
                `flex items-center gap-md py-md px-lg rounded-r-lg transition-all duration-200 ${
                  isActive
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

        <div className="px-lg pt-xl border-t border-outline-variant mt-auto">
          <div className="flex flex-col p-sm rounded-xl bg-surface-container-low border border-outline-variant">
            <div className="flex items-center gap-md p-xs">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="overflow-hidden">
                <p className="font-label-md text-label-md text-on-surface truncate m-0">
                  {user?.user_metadata?.full_name || (isDemo ? 'Demo User' : (user?.email || 'Voyanta Agent'))}
                </p>
              </div>
            </div>
          </div>
        </div>
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
          <div className="flex items-center flex-1 max-w-2xl gap-lg">
            {/* Search bar removed per request */}
          </div>
          <div className="flex items-center gap-md ml-lg relative">
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
        <div className="flex-1 overflow-y-auto px-lg lg:px-xxl pb-xxl pt-md">
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
    </div>
  );
}
