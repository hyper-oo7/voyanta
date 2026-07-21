import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useEntitlements } from '../hooks/useEntitlements.js';
import UpgradePlanModal from '../components/billing/UpgradePlanModal.jsx';
import { TEMPLATE_LIST } from '../templates/registry.js';

// Map all 96 templates from the central registry into structured gallery cards
export const TEMPLATES = TEMPLATE_LIST.map((t, idx) => {
  const slug = t.slug || `template-${idx}`;
  const catLower = (t.category || '').toLowerCase();
  
  let group = 'opulence';
  if (t.tier === 'Basic' || ['classic', 'editorial', 'vibrant', 'modern', 'honeymoon', 'family', 'safari', 'alpine', 'zen', 'aegean', 'desert', 'nordic', 'tropic', 'maharaja', 'cosmopolitan', 'eco_sanctuary'].includes(slug)) {
    group = 'basic';
  } else if (slug.startsWith('cult_') || catLower.includes('cultural') || catLower.includes('heritage') || catLower.includes('wellness') || catLower.includes('spa') || catLower.includes('sanctuary')) {
    group = 'wellness';
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
  { key: 'wellness', label: 'Wellness & Sanctuary', icon: 'spa', desc: 'Tranquil spa getaways, holistic yoga retreats, and nature sanctuaries.' },
  { key: 'opulence', label: 'Opulence & Bespoke', icon: 'diamond', desc: 'Royal gold accents and high-contrast dramatic visual styles.' },
  { key: 'basic', label: 'Classic & Basic Tier', icon: 'verified', desc: 'Timeless foundational layouts included with all standard plans.' },
];

export default function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  const { plan: backendPlan, refreshEntitlement } = useEntitlements();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [lockedTemplateName, setLockedTemplateName] = useState('');

  const storedPlan = typeof window !== 'undefined' ? (localStorage.getItem('voyanta_active_plan') || localStorage.getItem('voyanta_pending_subscription_plan') || localStorage.getItem('voyanta_user_plan') || 'Starter') : 'Starter';
  const currentPlan = (backendPlan && backendPlan.toLowerCase() !== 'starter') ? backendPlan : storedPlan;
  const isStarter = !currentPlan || currentPlan.toLowerCase() === 'starter';

  useEffect(() => {
    setPage(0);
  }, [activeTab, searchQuery]);

  const handleUseTemplate = (template) => {
    if (template.isPremium && isStarter) {
      setLockedTemplateName(template.title);
      setUpgradeModalOpen(true);
      return;
    }
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

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const paginatedTemplates = filteredTemplates.slice(page * pageSize, (page + 1) * pageSize);

  const renderTemplateCard = (t) => {
    const isLocked = t.isPremium && isStarter;
    return (
    <div key={t.id} className="glass-card rounded-2xl overflow-hidden flex flex-col group border border-outline-variant/50 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1.5 bg-white/90 dark:bg-surface-dark/90">
      <div className="h-56 relative overflow-hidden bg-surface-variant">
        <img 
          src={t.image} 
          alt={t.title} 
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isLocked ? 'filter brightness-90' : ''}`} 
        />
        
        {/* Category Badge */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-white/20 shadow-md z-10">
          {t.category}
        </div>

        {/* Golden Badge for Premium */}
        {t.isPremium && (
          <div className="absolute top-4 right-4 bg-black/85 backdrop-blur-md text-amber-400 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border border-amber-400/40 flex items-center gap-1.5 shadow-lg z-10">
            <span className="material-symbols-outlined text-[14px]">{isLocked ? 'lock' : 'diamond'}</span> {isLocked ? 'Premium' : 'Pro Unlocked'}
          </div>
        )}

        {/* Blurred Glass Lock Overlay ONLY for Starter tier */}
        {isLocked ? (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] flex flex-col items-center justify-center transition-all duration-500 group-hover:backdrop-blur-md group-hover:bg-black/75 p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2 border border-amber-400/40 shadow-xl transform group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider mb-1 drop-shadow">Premium Magazine Layout</span>
            <span className="text-white/75 text-[11px] mb-4 drop-shadow-sm max-w-[210px] leading-snug">Unlock magazine-quality design with Pro or Enterprise</span>
            
            <button 
              onClick={() => handleUseTemplate(t)}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold py-2.5 px-4 rounded-lg shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest transform group-hover:translate-y-0 translate-y-1">
              <span className="material-symbols-outlined text-[16px]">lock</span> Unlock in Settings
            </button>
          </div>
        ) : (
          /* Normal Hover Overlay for Unlocked / Basic Templates */
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 z-10">
            <button 
              onClick={() => handleUseTemplate(t)}
              className="w-full bg-white text-primary font-bold py-3 rounded-lg shadow-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2">
              Start Editing <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">map</span>
            <span>{t.tour_type}</span>
          </div>
          <h3 className="font-headline-md text-xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors leading-snug">
            {t.title}
          </h3>
          <p className="text-sm text-on-surface-variant line-clamp-2 mb-6 font-normal">
            {t.description}
          </p>
        </div>

        <div className="pt-4 border-t border-outline-variant/60 flex items-center justify-between text-xs font-medium text-on-surface-variant">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-amber-500">schedule</span> {t.duration}</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-emerald-500">group</span> {t.min_pax}-{t.max_pax} Pax</span>
          </div>
          <span className="font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Preview <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-primary via-primary-container to-tertiary-container p-8 md:p-12 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase">
            Curated Blueprint Gallery
          </span>
          <h1 className="font-headline-md text-3xl md:text-5xl font-black tracking-tight">
            Design Stunning Proposals in Seconds
          </h1>
          <p className="text-sm md:text-base text-white/90 font-light leading-relaxed">
            Choose from 90+ meticulously designed, magazine-quality templates. Filter by category, luxury tier, or travel theme to match your client's exact aesthetic.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60 shadow-sm backdrop-blur-md bg-white/80 dark:bg-surface-dark/80">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-base">category</span>
            Category:
          </label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="px-4 py-2.5 bg-surface rounded-xl border border-outline-variant text-xs font-bold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm min-w-[240px] cursor-pointer"
          >
            {CATEGORY_GROUPS.map(cat => {
              const count = cat.key === 'all' ? TEMPLATES.length : TEMPLATES.filter(t => t.group === cat.key).length;
              return (
                <option key={cat.key} value={cat.key}>
                  {cat.label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div className="relative flex-1 max-w-xl">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search templates, vibes, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-surface rounded-xl border border-outline-variant text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Gallery */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-3xl border border-outline-variant/60 p-8 space-y-4">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">travel_explore</span>
          </div>
          <h3 className="font-headline-md text-xl font-bold text-on-surface">No matching layouts found</h3>
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
                  {catTemplates.slice(0, 3).map(renderTemplateCard)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Filtered Grid View with Pagination */
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/40 pb-3">
            <span>Showing {paginatedTemplates.length} of {filteredTemplates.length} layouts</span>
            {activeTab !== 'all' && (
              <span className="text-primary font-semibold">{CATEGORY_GROUPS.find(c => c.key === activeTab)?.label}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {paginatedTemplates.map(renderTemplateCard)}
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest rounded-2xl shadow-sm">
              <span className="text-xs font-semibold text-on-surface-variant">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filteredTemplates.length)} of {filteredTemplates.length} layouts
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span> Prev
                </button>
                <span className="px-3 py-1 text-xs font-extrabold text-primary font-mono">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
                >
                  Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <UpgradePlanModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        lockedItemName={lockedTemplateName}
        onUpgradeSuccess={(newPlan) => {
          const formatted = newPlan || 'Professional';
          localStorage.setItem('voyanta_active_plan', formatted);
          localStorage.setItem('voyanta_user_plan', formatted);
          window.dispatchEvent(new CustomEvent('voyanta:plan-updated'));
          toast.success(`Upgraded to ${formatted}! All Premium layouts unlocked.`);
          refreshEntitlement();
        }}
      />
    </div>
  );
}
