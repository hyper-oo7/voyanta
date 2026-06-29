import { useState, useEffect } from 'react';
import TemplateRenderer, { ALL as ALL_SECTIONS } from './TemplateRenderer.jsx';

// A realistic mock proposal to show in the live preview
const MOCK_DATA = {
  proposal: {
    name: 'The Santorini Experience',
    client_name: 'Luxury Client',
    destination: 'Santorini, Greece',
    start_date: '2026-09-10',
    end_date: '2026-09-17',
    travelers: 2,
    currency: 'USD',
    itinerary: {
      days: [
        {
          day: 1,
          title: 'Arrival in Paradise',
          description: 'Transfer to your cliffside suite in Oia.',
          block_type: 'day'
        },
        {
          day: 2,
          title: 'Caldera Yacht Tour',
          description: 'A private catamaran cruise around the volcanic islands.',
          block_type: 'day'
        }
      ]
    },
    preferences: {} // branding will be merged here
  },
  items: [
    { kind: 'hotel', label: 'Mystique, a Luxury Collection Hotel', qty: 7, unit_price: 1200, currency: 'USD' },
    { kind: 'flight', label: 'First Class - Emirates', qty: 2, unit_price: 3500, currency: 'USD' },
    { kind: 'activity', label: 'Private Yacht Cruise', qty: 2, unit_price: 800, currency: 'USD' }
  ],
  computed_totals: {
    hotel: 8400,
    flight: 7000,
    activity: 1600,
    markup: 1500,
    tax: 350,
    grand: 18850
  }
};

export default function MobileLivePreview({ branding }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const sectionOrder = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

  const mergedData = {
    ...MOCK_DATA,
    proposal: {
      ...MOCK_DATA.proposal,
      preferences: {
        ...MOCK_DATA.proposal.preferences,
        branding: { ...branding }
      }
    }
  };

  const style = branding?.template_style || 'classic';

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-surface-container-highest rounded-xl p-md overflow-hidden relative shadow-inner border border-outline-variant">
      
      {/* Mobile Device Frame */}
      <div className="relative w-[320px] h-[650px] bg-black rounded-[40px] shadow-2xl p-2 flex flex-col overflow-hidden ring-4 ring-white/10 ring-offset-4 ring-offset-surface-container">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-6 bg-black rounded-b-xl w-32 mx-auto z-50 flex items-end justify-center pb-1">
          <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
        </div>

        {/* Screen */}
        <div className="flex-1 bg-white rounded-[32px] overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_20px_rgba(0,0,0,0.05)]"></div>
          
          <div className="w-full h-full" style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
            <div className="w-full h-full overflow-y-auto pb-20 no-scrollbar relative" data-testid="mobile-preview-screen">
              <TemplateRenderer 
                style={style} 
                data={mergedData} 
                include={ALL_SECTIONS} 
                order={sectionOrder} 
                viewMode="document" 
                activeSlide={activeSlide} 
              />
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1 inset-x-0 h-1 flex justify-center">
          <div className="w-24 h-1 bg-white/50 rounded-full"></div>
        </div>
      </div>
      
      <div className="mt-md text-center">
        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold flex items-center gap-1 justify-center">
          <span className="material-symbols-outlined text-[14px]">smartphone</span> Live Mobile Preview
        </span>
      </div>
    </div>
  );
}
