import { useNavigate } from 'react-router-dom';

export const TEMPLATES = [
  // Ultra Premium (5)
  {
    id: 't1',
    category: 'Ultra Premium',
    title: 'The Parisian Summer Escape',
    theme: 'modern',
    tour_type: 'Luxury',
    description: 'A masterpiece of editorial design, featuring large serif typography and dark accents. Perfect for high-end European journeys.',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't2',
    category: 'Ultra Premium',
    title: 'Zen & Neon: Japan',
    theme: 'dark',
    tour_type: 'Adventure',
    description: 'A stunning dark luxury template showcasing dramatic contrast. Ideal for futuristic or cultural immersions.',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't3',
    category: 'Ultra Premium',
    title: 'The Italian Riviera',
    theme: 'classic',
    tour_type: 'Honeymoon',
    description: 'Timeless, elegant, and romantic. This template uses classic European typography and warm tones.',
    image: 'https://images.unsplash.com/photo-1516483638261-f408892287c4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't4',
    category: 'Ultra Premium',
    title: 'Safari Expedition',
    theme: 'tropical',
    tour_type: 'Family',
    description: 'Earthy and vibrant, designed for nature and wildlife itineraries. Features lush green accents.',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't5',
    category: 'Ultra Premium',
    title: 'Corporate Executive',
    theme: 'corporate',
    tour_type: 'Corporate',
    description: 'Sleek, professional, and minimal. Uses sharp sans-serif fonts and stark blue accents for corporate retreats.',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
  },
  
  // Premium (5)
  {
    id: 't6',
    category: 'Premium',
    title: 'Coastal Wellness Retreat',
    theme: 'minimal',
    tour_type: 'Wellness',
    description: 'Clean lines and ample whitespace to create a calming, meditative reading experience.',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't7',
    category: 'Premium',
    title: 'Nordic Winter Adventure',
    theme: 'dark',
    tour_type: 'Adventure',
    description: 'Moody and atmospheric. Ideal for skiing trips or northern lights expeditions.',
    image: 'https://images.unsplash.com/photo-1523661149972-0cb29ce7382d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't8',
    category: 'Premium',
    title: 'Mediterranean Cruise',
    theme: 'classic',
    tour_type: 'Cruise',
    description: 'A traditional and refined layout perfect for multi-country cruise itineraries.',
    image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't9',
    category: 'Premium',
    title: 'Desert Mirage',
    theme: 'minimal',
    tour_type: 'Solo',
    description: 'Warm sandy tones and minimalist blocks. Great for Middle Eastern or African trips.',
    image: 'https://images.unsplash.com/photo-1542401886-65d6c61db217?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 't10',
    category: 'Premium',
    title: 'Island Hopping',
    theme: 'tropical',
    tour_type: 'Friends',
    description: 'Fun, bright, and airy. Designed for casual group trips and beach destinations.',
    image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80',
  }
];

export default function TemplatesPage() {
  const navigate = useNavigate();

  const handleUseTemplate = (template) => {
    navigate(`/templates/${template.id}`);
  };

  const renderTemplateCard = (t) => (
    <div key={t.id} className="glass-card rounded-2xl overflow-hidden flex flex-col group border border-outline-variant/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="h-48 relative overflow-hidden">
        <img src={t.image} alt={t.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20">
          {t.category}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
          <button 
            onClick={() => handleUseTemplate(t)}
            className="w-full bg-white text-primary font-bold py-3 rounded-lg shadow-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2">
            Start Editing <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-headline-sm text-primary mb-2">{t.title}</h3>
        <p className="font-body-sm text-on-surface-variant mb-4 flex-1">{t.description}</p>
        
        <div className="flex items-center gap-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest border-t border-outline-variant/50 pt-4">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">palette</span> {t.theme}</span>
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">travel_explore</span> {t.tour_type}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 pb-24" data-testid="templates-page">
      <header className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="font-display text-5xl md:text-6xl text-primary leading-tight">Proposal Gallery</h1>
        <p className="font-body-lg text-on-surface-variant text-lg md:text-xl">
          Discover a curated collection of ultra-premium and premium aesthetic blueprints. Start with a visual theme and let the wizard guide your design.
        </p>
      </header>

      <section>
        <div className="flex items-center gap-4 mb-8 border-b border-outline-variant/50 pb-4">
          <span className="material-symbols-outlined text-amber-500 text-[32px]">stars</span>
          <h2 className="font-headline-md text-3xl text-on-surface">Ultra Premium Collection</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {TEMPLATES.filter(t => t.category === 'Ultra Premium').map(renderTemplateCard)}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-4 mb-8 border-b border-outline-variant/50 pb-4">
          <span className="material-symbols-outlined text-tertiary text-[32px]">verified</span>
          <h2 className="font-headline-md text-3xl text-on-surface">Premium Collection</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {TEMPLATES.filter(t => t.category === 'Premium').map(renderTemplateCard)}
        </div>
      </section>
    </div>
  );
}
