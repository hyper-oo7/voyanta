import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { incrementAnalytics } from '../services/analyticsService.js';
import { logActivity } from '../services/activityLogService.js';

export default function ProposalActionRoute() {
  const [params] = useSearchParams();

  useEffect(() => {
    const type = params.get('type') || 'approval';
    const id = params.get('id') || '';
    const client = params.get('client') || 'Valued Client';
    const dest = params.get('dest') || 'Luxury Destination';
    const phone = (params.get('phone') || '+919876543210').replace(/[^0-9]/g, '');
    const name = params.get('name') || 'Curated Itinerary';

    // Record the analytics stat and trigger client approval / modification notification
    incrementAnalytics(type, id, dest, client);
    logActivity(type === 'modification' ? 'modification' : 'approval', `Client ${client} clicked ${type} on proposal for ${dest}`, client);

    // Prepare WhatsApp redirect text
    let text = `Hello! We have reviewed the proposal for ${dest} (${name}) and are absolutely delighted with the curated itinerary. We would like to approve this proposal and proceed with the reservation.`;
    if (type === 'modification') {
      text = `Hello! Thank you for curating this proposal for ${dest} (${name}). We love the luxury concept and would like to request a few modifications to customize it further.`;
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

    // Redirect to WhatsApp after 800ms so the user sees the confirmation
    const timer = setTimeout(() => {
      window.location.replace(waUrl);
    }, 800);

    return () => clearTimeout(timer);
  }, [params]);

  return (
    <div className="min-h-screen bg-[#0b1c30] text-[#f0f6fc] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#10b981]/20 text-[#10b981] flex items-center justify-center mb-6 animate-pulse">
        <span className="material-symbols-outlined text-[36px]">travel_explore</span>
      </div>
      <h1 className="font-display text-3xl font-bold mb-3 tracking-tight">Connecting to Concierge</h1>
      <p className="text-base text-gray-400 max-w-md font-light leading-relaxed">
        We have recorded your preference. Redirecting you to WhatsApp to connect with your dedicated travel curator immediately...
      </p>
      <div className="mt-8 flex items-center gap-2 text-xs text-[#10b981] font-semibold tracking-wider uppercase">
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
        Securely Routing to WhatsApp
      </div>
    </div>
  );
}
