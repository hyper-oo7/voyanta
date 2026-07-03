import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { TEMPLATES } from './TemplatesPage.jsx';
import TemplateRenderer, { ALL } from '../components/TemplateRenderer.jsx';

export default function TemplatePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const template = TEMPLATES.find(t => t.id === id);
  
  if (!template) {
    return <div className="p-xl text-center">Template not found. <Link to="/templates" className="text-primary underline">Go back</Link></div>;
  }

  // Construct incredibly realistic mock data for the preview based on the template
  const mockProposal = {
    name: template.title,
    client_name: 'The Henderson Family',
    destination: template.id === 't2' ? 'Japan' : (template.id === 't3' ? 'Italy' : 'Paris & Loire Valley'),
    travelers: 2,
    preferences: {
      tour_type: template.tour_type,
      branding: {
        agency_name: 'Voyanta Luxury Travel',
        template_style: template.theme,
        cover_image_url: template.image,
        highlights: 'This is a curated, once-in-a-lifetime journey designed specifically to immerse you in the culture, beauty, and luxury of the destination. Every detail has been meticulously planned to ensure a seamless and unforgettable experience.',
        inclusions: '✅ Luxury Accommodations\n✅ Private Airport Transfers\n✅ Expert Local Guides\n✅ VIP Access to Attractions\n✅ 24/7 Concierge Support',
        exclusions: '❌ International Flights\n❌ Travel Insurance\n❌ Personal Expenses\n❌ Gratuities',
        terms_of_payment: 'A 30% non-refundable deposit is required to secure the booking. The remaining balance is due 60 days prior to departure.',
        contact_email: 'hello@voyanta.com',
        contact_phone: '+1 (555) 123-4567',
        website: 'www.voyanta.com'
      }
    },
    itinerary: {
      days: [
        {
          day: 1,
          title: 'Arrival & VIP Transfer',
          description: 'You will be greeted at the jet bridge by a private concierge who will fast-track you through customs. From there, a private chauffeur will transfer you to your luxury hotel.',
        },
        {
          day: 2,
          title: 'Immersive Cultural Tour',
          description: 'An expert-led private tour focusing on the hidden gems of the city. Enjoy exclusive tastings, behind-the-scenes access, and a reservations-only lunch at a Michelin-starred restaurant.',
        },
        {
          day: 3,
          title: 'Leisure & Wellness',
          description: 'A day at your leisure. Enjoy the world-class spa facilities at your hotel, explore the local boutiques, or simply relax by the pool. In the evening, a sunset cruise awaits.',
        }
      ]
    }
  };

  const mockItems = {
    hotel: [
      { id: 'h1', kind: 'hotel', label: 'Grand Luxury Resort & Spa', qty: 1, unit_price: 1250, meta: { day: 1 } },
      { id: 'h2', kind: 'hotel', label: 'Boutique Heritage Hotel', qty: 1, unit_price: 950, meta: { day: 3 } }
    ],
    flight: [
      { id: 'f1', kind: 'flight', label: 'First Class Arrival', qty: 2, unit_price: 4500, meta: { day: 1 } }
    ],
    activity: [
      { id: 'a1', kind: 'activity', label: 'Private Michelin Dining', qty: 2, unit_price: 450, meta: { day: 2 } },
      { id: 'a2', kind: 'activity', label: 'Sunset Yacht Charter', qty: 1, unit_price: 1200, meta: { day: 3 } }
    ]
  };

  const mockTotals = {
    subtotal: 14500,
    currency: 'USD'
  };

  const mockData = {
    proposal: mockProposal,
    items_by_kind: mockItems,
    totals: mockTotals
  };

  const startEditing = () => {
    navigate(`/proposals/wizard?theme=${template.theme}&tour_type=${template.tour_type}`);
  };

  return (
    <div className="relative min-h-screen bg-surface-container-lowest">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-outline-variant/50 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/templates')} className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="font-label-md">Back to Gallery</span>
          </button>
          <div className="h-6 w-px bg-outline-variant"></div>
          <div>
            <h1 className="font-label-lg text-primary">{template.title}</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest">{template.category} Theme Preview</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={startEditing} className="px-6 py-2.5 bg-primary text-white rounded-lg font-label-md hover:bg-primary/90 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
            Use this Template <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
      </div>

      {/* Preview Canvas */}
      <div className="mx-auto w-full max-w-[210mm] py-8 transition-all duration-500 ease-in-out">
        <div className="bg-white shadow-2xl relative" style={{ minHeight: '297mm' }}>
           <TemplateRenderer 
             style={template.theme} 
             data={mockData} 
             include={ALL} 
             viewMode="document"
           />
        </div>
      </div>
    </div>
  );
}
