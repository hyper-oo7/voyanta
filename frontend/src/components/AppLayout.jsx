import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const navItems = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { path: '/proposals/wizard', icon: 'add_box', label: 'New Proposal' },
  { path: '/proposals', icon: 'folder_open', label: 'Proposals' },
  { path: '/templates', icon: 'description', label: 'Templates' },
  { path: '/libraries/hotels', icon: 'hotel', label: 'Hotels' },
  { path: '/flights', icon: 'flight', label: 'Flights' },
  { path: '/itinerary', icon: 'local_activity', label: 'Itinerary' },
  { path: '/cost-calculator', icon: 'calculate', label: 'Cost Calculator' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isDemo, signOut } = useAuth();

  const isDashboard = location.pathname === '/dashboard';

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const notifRef = useRef(null);
  const helpRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
      if (helpRef.current && !helpRef.current.contains(event.target)) setShowHelp(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [notifications, setNotifications] = useState([
    { id: 1, icon: 'mail', title: 'Proposal Sent', desc: "Alex sent 'Tokyo Neon Nights' to Marcus Thorne.", time: '2 hours ago', unread: true },
    { id: 2, icon: 'check_circle', title: 'Proposal Accepted', desc: "'Alpine Escape' was accepted by Eleanor Vance.", time: '5 hours ago', unread: true },
    { id: 3, icon: 'sync', title: 'Database Sync', desc: 'Global hotel inventory updated successfully.', time: 'Yesterday', unread: false }
  ]);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({...n, unread: false})));

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
              <span className="font-label-md text-label-md">{item.label}</span>
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
                <p className="font-label-sm text-label-sm text-on-surface-variant truncate m-0">
                  {isDemo ? 'Demo Session' : user?.email}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center mt-sm px-xs border-t border-outline-variant pt-sm">
              <Link to="/plan" className="text-[11px] font-bold text-primary hover:underline uppercase tracking-wider">My Plan</Link>
              <button onClick={handleSignOut} className="text-[11px] font-bold text-error hover:underline uppercase tracking-wider bg-transparent border-none cursor-pointer">Log Out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
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
                    {notifications.map(n => (
                      <div key={n.id} className={`flex items-start gap-md p-md hover:bg-surface-container-lowest transition-colors ${n.unread ? 'bg-surface-container-low/20' : ''}`}>
                        <div className="w-8 h-8 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0 text-on-primary-container">
                          <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-body-md text-xs font-semibold text-on-surface m-0">{n.title}</p>
                          <p className="font-body-md text-xs text-on-surface-variant m-0 mt-0.5 leading-snug">{n.desc}</p>
                          <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider m-0 mt-xs">{n.time}</p>
                        </div>
                        {n.unread && <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>}
                      </div>
                    ))}
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
    </div>
  );
}
