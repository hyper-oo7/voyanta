import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { fetchDashboardSummary } from '../services/dashboardService.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  
  const [data, setData] = useState({
    totalProposals: 0,
    totalTemplates: 0,
    activeClients: 0,
    recentProposals: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchDashboardSummary();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e.message || 'Failed to load dashboard');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  return (
    <div className="space-y-xl max-w-[1200px] mx-auto pb-xxl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg border-b border-outline-variant pb-lg">
        <div>
          <h2 className="font-headline-lg text-[32px] font-bold text-on-surface m-0 tracking-tight">Agent Dashboard</h2>
          <p className="font-body-lg text-on-surface-variant m-0 mt-xs">Your concierge operations at a glance.</p>
        </div>
        <button 
          onClick={() => navigate('/proposals/wizard')}
          className="flex items-center gap-sm px-xl py-md bg-on-surface text-surface rounded-lg font-label-md hover:opacity-90 active:scale-[0.98] transition-all border-none"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create New Proposal
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        <StatCard title="TOTAL PROPOSALS" value={loading ? "..." : data.totalProposals} icon="folder" />
        <StatCard title="TOTAL TEMPLATES" value={loading ? "..." : data.totalTemplates} icon="description" />
        <StatCard title="ACTIVE CLIENTS" value={loading ? "..." : data.activeClients} icon="person" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-xl">
          
          {/* Recent Proposals Table */}
          <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
            <div className="px-xl py-lg flex justify-between items-center">
              <h3 className="font-headline-sm text-lg font-medium text-on-surface m-0">Recent Proposals</h3>
              <button 
                onClick={() => navigate('/proposals')}
                className="text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors bg-transparent border-none p-0"
              >
                View All
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-t border-b border-outline-variant">
                    <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Proposal Name</th>
                    <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Client</th>
                    <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                    <th className="px-xl py-md font-label-sm text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-xl py-xxl text-center text-on-surface-variant font-body-md">Loading proposals...</td>
                    </tr>
                  ) : data.recentProposals.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-xl py-xxl text-center text-on-surface-variant font-body-md">No proposals found. Create your first one above!</td>
                    </tr>
                  ) : (
                    data.recentProposals.map(p => (
                      <tr 
                        key={p.id} 
                        onClick={() => navigate(`/proposals/wizard?id=${encodeURIComponent(p.id)}&step=8`)}
                        className="hover:bg-surface-container-lowest transition-colors cursor-pointer group"
                      >
                        <td className="px-xl py-lg">
                          <div className="font-body-md text-on-surface group-hover:text-primary transition-colors">{p.name}</div>
                        </td>
                        <td className="px-xl py-lg font-body-md text-on-surface">{p.client_name || p.client || '—'}</td>
                        <td className="px-xl py-lg">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-xl py-lg font-body-md text-on-surface-variant">
                          {p.date ? new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Banner */}
          <div className="relative bg-surface border border-outline-variant rounded-2xl overflow-hidden flex flex-col sm:flex-row items-center p-xl gap-xl">
             <div className="absolute top-0 right-0 w-1/2 h-full">
                <img 
                  src="https://images.unsplash.com/photo-1533587851505-d119e13bf0eb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                  alt="Amalfi Coast" 
                  className="w-full h-full object-cover mask-image-gradient-l"
                  style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 100%)' }}
                />
             </div>
             <div className="relative z-10 max-w-sm">
                <div className="inline-block px-sm py-xs bg-on-surface text-surface text-[10px] font-bold uppercase tracking-widest rounded mb-md">
                  Curated Destination
                </div>
                <h3 className="font-display text-2xl mb-sm text-on-surface">Discover the Amalfi Coast</h3>
                <p className="font-body-md text-on-surface-variant mb-lg leading-relaxed">
                  Access exclusive agent rates and pre-built itineraries for this season's most sought-after location.
                </p>
                <a href="#" className="font-label-sm text-sm font-bold text-on-surface hover:text-primary border-b border-on-surface hover:border-primary pb-1 transition-colors">
                  Explore Destination Pack
                </a>
             </div>
          </div>

        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-xl">
          
          {/* Quick Actions (Dark Card) */}
          <div className="bg-[#0F172A] rounded-2xl p-xl shadow-lg relative overflow-hidden">
             {/* Subtle grid pattern background */}
             <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
             
             <div className="relative z-10">
               <h3 className="font-display text-lg text-white mb-lg m-0">Quick Actions</h3>
               <div className="space-y-md">
                 <button 
                   onClick={() => navigate('/libraries/hotels')}
                   className="w-full flex items-center gap-md p-md bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-xl transition-colors text-white text-left group"
                 >
                   <span className="material-symbols-outlined text-white/70 group-hover:text-white transition-colors">hotel</span>
                   <span className="font-body-md text-sm font-medium">Upload Hotel Database</span>
                 </button>
                 <button 
                   onClick={() => navigate('/activities')}
                   className="w-full flex items-center gap-md p-md bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-xl transition-colors text-white text-left group"
                 >
                   <span className="material-symbols-outlined text-white/70 group-hover:text-white transition-colors">local_activity</span>
                   <span className="font-body-md text-sm font-medium">Upload Activities Database</span>
                 </button>
               </div>
             </div>
          </div>


          {/* AI Proposal Assistant */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-xl text-center flex flex-col items-center">
             <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-md">
               <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
             </div>
             <h3 className="font-display text-lg text-on-surface mb-xs m-0">AI Proposal Assistant</h3>
             <p className="font-body-md text-sm text-on-surface-variant mb-lg leading-relaxed px-md">
               Draft complex itineraries 3x faster with our new intelligent routing engine.
             </p>
             <button className="px-lg py-sm border border-outline-variant text-on-surface rounded-lg font-label-sm text-sm hover:bg-surface-container-lowest transition-colors">
               Try Beta Feature
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-surface border border-outline-variant p-xl rounded-2xl flex flex-col justify-between h-36">
      <div className="flex items-center justify-between">
        <p className="font-label-sm text-[11px] font-bold text-on-surface-variant uppercase tracking-widest m-0">{title}</p>
        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      <h3 className="font-display text-[40px] leading-none text-on-surface m-0">{value}</h3>
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

