import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedProposalByToken } from '../services/proposalItemService.js';
import { api } from '../services/api.js';
import { formatPrice } from '../lib/currency.js';
import { useToast } from '../context/ToastContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function WebViewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPricing, setShowPricing] = useState(true);
  
  // For Signature & Action
  const [actionLoading, setActionLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    fetchSharedProposalByToken(token)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
          // Analytics hook
          api.post('/api/activity-log', { action: 'viewed_proposal', proposal_id: res.proposal.id }).catch(()=>console.log('analytics failed'));
          
          // Apply branding
          const branding = res.proposal?.preferences?.branding;
          if (branding?.theme_color) {
            document.documentElement.style.setProperty('--color-primary', branding.theme_color);
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Proposal not found');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface font-body-md text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4 text-primary">progress_activity</span>
        Loading your proposal...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface font-body-md text-error p-lg text-center">
        <span className="material-symbols-outlined text-4xl mb-4">error</span>
        <h2>{error || 'Proposal not found or expired'}</h2>
      </div>
    );
  }

  const p = data.proposal || {};
  const items = data.items || [];
  const branding = p.preferences?.branding || {};
  
  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      await api.post(`/api/public/proposals/${token}/action`, { action });
      if (action === 'Approve') {
        setIsApproved(true);
        toast.success("Proposal approved successfully!");
      } else {
        toast.info("Changes requested. The agency has been notified.");
      }
    } catch (err) {
      toast.error(`Failed to submit action: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      toast.info("Generating PDF...");
      // In production we'd call the PDF API. For now, simulate.
      setTimeout(() => {
        toast.success("PDF Downloaded!");
      }, 2000);
    } catch (e) {
      toast.error("PDF generation failed");
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface pb-32">
      {/* HERO SECTION */}
      <div className="relative h-64 md:h-96 w-full">
        {/* Use the first hotel image or a placeholder based on destination */}
        <img 
          src={`https://source.unsplash.com/1200x800/?travel,${encodeURIComponent(p.destination || 'luxury')}`} 
          alt="Destination" 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80 flex flex-col justify-end p-xl">
          <h1 className="text-3xl md:text-5xl font-display text-white mb-2">{p.name || 'Your Travel Proposal'}</h1>
          <p className="text-lg text-white/90">{p.destination} • {p.travelers} Travelers</p>
        </div>
      </div>

      {/* AGENCY BRANDING */}
      <div className="bg-surface-container p-xl flex items-center justify-between border-b border-outline-variant">
        <div className="flex items-center gap-md">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Agency Logo" className="h-12 w-auto object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold">
              {p.client_name?.charAt(0) || 'A'}
            </div>
          )}
          <div>
            <div className="font-bold text-lg">{branding.company_name || 'Travel Agency'}</div>
            <div className="text-sm text-on-surface-variant">Prepared for {p.client_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-sm">
           <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
             <input type="checkbox" checked={showPricing} onChange={(e) => setShowPricing(e.target.checked)} className="rounded border-outline text-primary focus:ring-primary h-4 w-4" />
             Show Pricing
           </label>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-xl space-y-xl">
        {/* ITINERARY TIMELINE */}
        <section>
          <h2 className="text-2xl font-display mb-md">Itinerary Overview</h2>
          <div className="space-y-md">
            {(p.trip_details?.days || []).map((day, idx) => (
              <ItineraryDayCard key={idx} day={day} dayNumber={idx + 1} />
            ))}
          </div>
        </section>

        {/* INCLUDED ITEMS (Hotels, Flights, etc) */}
        <section>
          <h2 className="text-2xl font-display mb-md">Included in your trip</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {items.map(item => (
              <div key={item.id} className="glass-card p-md rounded-xl flex gap-md">
                <div className="w-24 h-24 rounded-lg bg-surface-variant shrink-0 overflow-hidden">
                  <img src={`https://source.unsplash.com/400x400/?${encodeURIComponent(item.name || item.kind)}`} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <p className="text-sm text-on-surface-variant capitalize">{item.kind}</p>
                  {showPricing && <p className="font-bold text-primary mt-2">{formatPrice(item.qty * item.unit_price, data.totals.currency)}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* MAP EMBED */}
        <section>
           <h2 className="text-2xl font-display mb-md">Map Location</h2>
           <div className="w-full h-64 rounded-xl overflow-hidden shadow-sm border border-outline-variant">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight="0" 
                marginWidth="0" 
                src={`https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik&marker=0,0`} 
                style={{ border: 'none' }}
                title="Destination Map"
              ></iframe>
           </div>
        </section>
        
        {/* COST BREAKDOWN */}
        {showPricing && (
          <section className="bg-surface-container rounded-xl p-xl">
            <h2 className="text-2xl font-display mb-md">Total Cost</h2>
            <div className="flex justify-between items-end border-t border-outline-variant pt-md">
              <span className="text-lg font-bold">Subtotal</span>
              <span className="text-3xl font-display text-primary">{formatPrice(data.totals.subtotal, data.totals.currency)}</span>
            </div>
          </section>
        )}
      </div>

      {/* CLIENT ACTIONS BAR (Sticky bottom on mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant p-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        <div className="max-w-4xl mx-auto flex gap-md justify-end items-center">
          <button onClick={handleDownloadPDF} className="p-sm text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center rounded-full bg-surface-container" title="Download PDF">
            <span className="material-symbols-outlined">download</span>
          </button>
          
          {!isApproved ? (
            <>
              <button onClick={() => handleAction('Request Changes')} disabled={actionLoading} className="btn-secondary py-sm px-lg rounded-full font-bold">
                Request Changes
              </button>
              <button onClick={() => handleAction('Approve')} disabled={actionLoading} className="btn-primary py-sm px-xl rounded-full font-bold shadow-md">
                {actionLoading ? 'Processing...' : 'Approve Proposal'}
              </button>
            </>
          ) : (
             <div className="bg-green-100 text-green-800 px-lg py-sm rounded-full font-bold flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">check_circle</span> Approved
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Itinerary Day Card
function ItineraryDayCard({ day, dayNumber }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface transition-shadow hover:shadow-sm">
      <button className="w-full p-lg flex items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-md">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">D{dayNumber}</div>
          <div>
            <h3 className="font-bold text-lg">{day.title || `Day ${dayNumber}`}</h3>
          </div>
        </div>
        <span className={`material-symbols-outlined transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-lg pt-0 text-on-surface-variant leading-relaxed border-t border-outline-variant/50">
              {day.description || 'No description provided.'}
              <div className="mt-md flex gap-sm overflow-x-auto pb-sm no-scrollbar">
                {/* Mock day photos */}
                <img src={`https://source.unsplash.com/300x200/?travel,day${dayNumber}`} alt="Day visual" className="w-32 h-24 object-cover rounded-lg shrink-0" loading="lazy" />
                <img src={`https://source.unsplash.com/300x200/?hotel,day${dayNumber}`} alt="Hotel visual" className="w-32 h-24 object-cover rounded-lg shrink-0" loading="lazy" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
