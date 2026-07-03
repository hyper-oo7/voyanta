import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEMPLATE_LIST } from '../templates/registry.js';

// Map all 96 templates from the central registry into structured gallery cards
export const TEMPLATES = TEMPLATE_LIST.map((t, idx) => {
  const slug = t.slug || `template-${idx}`;
  const catLower = (t.category || '').toLowerCase();
  
  let group = 'opulence';
  if (t.tier === 'Basic' || ['classic', 'editorial', 'vibrant', 'modern', 'honeymoon', 'family', 'safari', 'alpine', 'zen', 'aegean', 'desert', 'nordic', 'tropic', 'maharaja', 'cosmopolitan', 'eco_sanctuary'].includes(slug)) {
    group = 'basic';
  } else if (catLower.includes('luxury') || catLower.includes('magazine') || catLower.includes('creative')) {
    group = 'luxury';
  } else if (catLower.includes('minimal') || catLower.includes('modern')) {
    group = 'minimal';
  } else if (catLower.includes('corporate') || catLower.includes('executive') || catLower.includes('professional')) {
    group = 'corporate';
  } else if (catLower.includes('honeymoon') || catLower.includes('romantic')) {
    group = 'honeymoon';
  } else if (catLower.includes('family') || catLower.includes('warm') || catLower.includes('group')) {
    group = 'family';
  } else if (catLower.includes('adventure') || catLower.includes('safari') || catLower.includes('expedition')) {
    group = 'adventure';
  } else if (catLower.includes('cultural') || catLower.includes('heritage') || catLower.includes('wellness')) {
    group = 'cultural';
  }

  const isPremium = group !== 'basic';

  return {
    id: slug,
    title: t.name || 'Bespoke Template',
    category: t.category || (isPremium ? 'Luxury Magazine' : 'Basic Tier'),
    tier: t.tier || (isPremium ? 'Premium' : 'Basic'),
    group,
    theme: slug,
    tour_type: Array.isArray(t.bestFor) && t.bestFor.length > 0 ? t.bestFor[0].toUpperCase() : 'LUXURY',
    description: t.description || 'An elevated layout crafted for high-end travel presentations and client proposals.',
    image: t.thumbnail || 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
    isPremium
  };
});

const CATEGORY_GROUPS = [
  { key: 'all', label: 'All Layouts', icon: 'apps', desc: 'Browse our entire gallery of 90+ magazine-quality proposal blueprints.' },
  { key: 'luxury', label: 'Luxury Magazine & Editorial', icon: 'auto_awesome', desc: 'Condé Nast & National Geographic style full-bleed magazine layouts.' },
  { key: 'minimal', label: 'Minimal Modern Clean', icon: 'space_dashboard', desc: 'Swiss design aesthetics with crisp typography and ample whitespace.' },
  { key: 'corporate', label: 'Corporate & Executive', icon: 'business_center', desc: 'Structured tables and executive summaries for high-level business travel.' },
  { key: 'honeymoon', label: 'Honeymoon & Romantic', icon: 'favorite', desc: 'Intimate, warm, and romantic spreads for couples and luxury getaways.' },
  { key: 'family', label: 'Family & Group Retreats', icon: 'family_restroom', desc: 'Spacious multi-generational layouts with clear scheduling and activities.' },
  { key: 'adventure', label: 'Adventure & Expeditions', icon: 'explore', desc: 'Dynamic timeline tracking and safari photography visual features.' },
  { key: 'cultural', label: 'Cultural & Wellness', icon: 'self_improvement', desc: 'Tranquil aesthetics and deep cultural storytelling designs.' },
  { key: 'opulence', label: 'Opulence & Bespoke', icon: 'diamond', desc: 'Royal gold accents and high-contrast dramatic visual styles.' },
  { key: 'basic', label: 'Classic & Basic Tier', icon: 'verified', desc: 'Timeless foundational layouts included with all standard plans.' },
];

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleUseTemplate = (template) => {
    navigate(`/templates/${template.id}`);
  };

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter(t => {
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tour_type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || t.group === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [activeTab, searchQuery]);

  const renderTemplateCard = (t) => (
    <div key={t.id} className="glass-card rounded-2xl overflow-hidden flex flex-col group border border-outline-variant/50 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1.5 bg-white/90 dark:bg-surface-dark/90">
      <div className="h-56 relative overflow-hidden bg-surface-variant">
        <img 
          src={t.image} 
          alt={t.title} 
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${t.isPremium ? 'filter brightness-90' : ''}`} 
        />
        
        {/* Category Badge */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-white/20 shadow-md z-10">
          {t.category}
        </div>

        {/* Golden Lock Badge for Premium */}
        {t.isPremium && (
          <div className="absolute top-4 right-4 bg-black/85 backdrop-blur-md text-amber-400 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-amber-400/40 flex items-center gap-1.5 shadow-lg z-10 animate-pulse">
            <span className="material-symbols-outlined text-[14px]">lock</span> Premium
          </div>
        )}

        {/* Blurred Glass Lock Overlay on Premium Templates */}
        {t.isPremium ? (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] flex flex-col items-center justify-center transition-all duration-500 group-hover:backdrop-blur-md group-hover:bg-black/75 p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2 border border-amber-400/40 shadow-xl transform group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider mb-1 drop-shadow">Premium Magazine Layout</span>
            <span className="text-white/75 text-[11px] mb-4 drop-shadow-sm max-w-[210px] leading-snug">Unlock magazine-quality design with Pro or Enterprise</span>
            
            <button 
              onClick={() => handleUseTemplate(t)}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold py-2.5 px-4 rounded-lg shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest transform group-hover:translate-y-0 translate-y-1">
              <span className="material-symbols-outlined text-[16px]">lock_open</span> Preview & Unlock
            </button>
          </div>
        ) : (
          /* Normal Hover Overlay for Basic Templates */
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 z-10">
            <button 
              onClick={() => handleUseTemplate(t)}
              className="w-full bg-white text-primary font-bold py-3 rounded-lg shadow-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2">
              Start Editing <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-headline-sm text-primary font-bold text-lg leading-snug group-hover:text-accent transition-colors">{t.title}</h3>
            {t.isPremium && <span className="material-symbols-outlined text-amber-500 text-[18px]" title="Premium Layout">workspace_premium</span>}
          </div>
          <p className="font-body-sm text-on-surface-variant text-xs line-clamp-2 leading-relaxed">{t.description}</p>
        </div>
        
        <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-widest border-t border-outline-variant/50 pt-3 mt-auto">
          <span className="flex items-center gap-1.5 truncate max-w-[140px]"><span className="material-symbols-outlined text-[15px] text-primary flex-shrink-0">palette</span> <span className="truncate">{t.theme}</span></span>
          <span className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded text-primary flex-shrink-0"><span className="material-symbols-outlined text-[15px]">travel_explore</span> {t.tour_type}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10 pb-24" data-testid="templates-page">
      {/* Header */}
      <header className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest">
          <span className="material-symbols-outlined text-[16px]">menu_book</span> Voyanta Proposal Gallery
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-primary leading-tight font-extrabold">
          Magazine-Quality Blueprints
        </h1>
        <p className="font-body-lg text-on-surface-variant text-base md:text-lg">
          Explore {TEMPLATES.length} premium and classic layouts. Every proposal is rendered from structured data, allowing seamless visual rotation and styling.
        </p>
      </header>

      {/* Search & Category Tabs */}
      <div className="space-y-6">
        <div className="max-w-md mx-auto relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input 
            type="text"
            placeholder="Search templates by style, destination, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant hover:text-primary">
              Clear
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar justify-start md:justify-center flex-wrap">
          {CATEGORY_GROUPS.map(cat => {
            const count = cat.key === 'all' ? TEMPLATES.length : TEMPLATES.filter(t => t.group === cat.key).length;
            const isActive = activeTab === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-primary text-white shadow-lg scale-105' 
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:border-primary/40 hover:text-primary'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-amber-400' : 'text-primary/70'}`}>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Display */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">search_off</span>
          <h3 className="text-lg font-bold text-on-surface">No templates matched your search</h3>
          <p className="text-sm text-on-surface-variant mt-1">Try searching with different keywords or switch category tabs.</p>
          <button onClick={() => { setSearchQuery(''); setActiveTab('all'); }} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider">
            Reset Filters
          </button>
        </div>
      ) : activeTab === 'all' && !searchQuery ? (
        /* Category-Wise Section View when All Layouts is selected */
        <div className="space-y-16">
          {CATEGORY_GROUPS.filter(c => c.key !== 'all').map(cat => {
            const catTemplates = TEMPLATES.filter(t => t.group === cat.key);
            if (catTemplates.length === 0) return null;
            return (
              <section key={cat.key} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-outline-variant/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-2xl md:text-3xl font-extrabold text-on-surface">{cat.label}</h2>
                      <p className="text-xs md:text-sm text-on-surface-variant">{cat.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab(cat.key)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 self-start md:self-auto"
                  >
                    View all {catTemplates.length} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {catTemplates.map(renderTemplateCard)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Filtered Grid View */
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/40 pb-3">
            <span>Showing {filteredTemplates.length} layouts</span>
            {activeTab !== 'all' && (
              <span className="text-primary font-semibold">{CATEGORY_GROUPS.find(c => c.key === activeTab)?.label}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredTemplates.map(renderTemplateCard)}
          </div>
        </div>
      )}
    </div>
  );
}
