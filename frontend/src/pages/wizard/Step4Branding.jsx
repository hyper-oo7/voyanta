import { memo, useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import LogoUploader from '../../components/LogoUploader.jsx';
import { TEMPLATE_LIST } from '../../templates/registry.js';
import { api } from '../../services/api.js';

const safeStr = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeStr).join('\n');
  if (typeof v === 'object') {
    if (v.content !== undefined) return safeStr(v.content);
    if (v.text !== undefined) return safeStr(v.text);
    if (v.value !== undefined) return safeStr(v.value);
    return JSON.stringify(v);
  }
  return String(v);
};

const Field = memo(function Field({ label, value, onChange, type = 'text', testid, extraClass = '' }) {
  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} value={safeStr(value)} onChange={onChange} data-testid={testid}
        className="px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
});

const Textarea = memo(function Textarea({ label, value, onChange, testid, placeholder = '' }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <textarea value={safeStr(value)} onChange={onChange} rows={3} placeholder={placeholder} data-testid={testid}
        className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
});

function TextareaWithAI({ label, value, onChange, testid, onAI }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="flex items-center justify-between font-label-md text-label-md text-on-surface">
        <span>{label}</span>
        <button type="button" onClick={onAI} data-testid={`${testid}-ai`}
          className="inline-flex items-center gap-xs px-md py-xs bg-primary/10 text-primary rounded-full font-label-sm hover:bg-primary/15">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Draft with AI
        </button>
      </span>
      <textarea value={safeStr(value)} onChange={onChange} rows={3} data-testid={testid}
        className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

export function Step4Branding({ branding, setBranding, customBlocks, proposal, client }) {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('voyanta_active_plan') || 'Starter') : 'Starter');

  useEffect(() => {
    const handler = () => setCurrentPlan(localStorage.getItem('voyanta_active_plan') || 'Starter');
    window.addEventListener('voyanta:plan-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('voyanta:plan-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // ── Destination Knowledge Auto-Fill ─────────────────────────────────────
  // Queries accumulated destination_knowledge from vault and populates:
  // inclusions, exclusions, what_to_pack, visa_guidelines, important_notes, etc.
  const [knowledgeSources, setKnowledgeSources] = useState({});

  useEffect(() => {
    const dest = client?.destination || proposal?.destination || '';
    if (!dest) return;

    let isMounted = true;

    (async () => {
      try {
        let token = null;
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
          if (session?.access_token) token = session.access_token;
        } catch {}

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/vault/knowledge?destination=${encodeURIComponent(dest)}`, { headers });
        if (res.ok && isMounted) {
          const json = await res.json();
          const knowledge = json.knowledge || {};

          if (Object.keys(knowledge).length === 0) return;

          const sources = {};
          const updates = {};

          // Auto-fill each section ONLY if not already filled by the agent
          if (knowledge.inclusions && !branding?.inclusions) {
            updates.inclusions = knowledge.inclusions.content;
            sources.inclusions = knowledge.inclusions.source_count;
          }
          if (knowledge.exclusions && !branding?.exclusions) {
            updates.exclusions = knowledge.exclusions.content;
            sources.exclusions = knowledge.exclusions.source_count;
          }
          if (knowledge.what_to_pack && !branding?.what_to_pack) {
            updates.what_to_pack = knowledge.what_to_pack.content;
            sources.what_to_pack = knowledge.what_to_pack.source_count;
          }
          if (knowledge.important_notes && !branding?.important_notes) {
            updates.important_notes = knowledge.important_notes.content;
            sources.important_notes = knowledge.important_notes.source_count;
          }
          if (knowledge.visa_guidelines && !branding?.visa_guidelines) {
            updates.visa_guidelines = knowledge.visa_guidelines.content;
            sources.visa_guidelines = knowledge.visa_guidelines.source_count;
          }
          if (knowledge.cancellation_policy && !branding?.cancellation_policy) {
            updates.cancellation_policy = knowledge.cancellation_policy.content;
            sources.cancellation_policy = knowledge.cancellation_policy.source_count;
          }
          if (knowledge.terms_of_payment && !branding?.terms_of_payment) {
            updates.terms_of_payment = knowledge.terms_of_payment.content;
            sources.terms_of_payment = knowledge.terms_of_payment.source_count;
          }

          // Accumulate dynamic extra sections into custom_fields
          const dynamicSections = Object.entries(knowledge).filter(([k]) =>
            !['inclusions', 'exclusions', 'what_to_pack', 'important_notes', 'visa_guidelines', 'cancellation_policy', 'terms_of_payment'].includes(k)
          );
          if (dynamicSections.length > 0) {
            const existingCustom = branding?.custom_fields || [];
            const existingKeys = new Set(existingCustom.map(f => f.section_type || f.label?.toLowerCase()));
            const newFields = dynamicSections
              .filter(([k]) => !existingKeys.has(k))
              .map(([k, v]) => ({
                id: `vault_knowledge_${k}_${Math.random().toString(36).slice(2, 6)}`,
                label: safeStr(v.title || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
                value: safeStr(v.content),
                type: 'text',
                section_type: k,
                vault_auto_filled: true,
                source_count: v.source_count,
              }));
            if (newFields.length > 0) {
              updates.custom_fields = [...existingCustom, ...newFields];
            }
          }

          if (Object.keys(updates).length > 0) {
            setBranding(s => ({ ...s, ...updates }));
            setKnowledgeSources(sources);
            toast.info(`Auto-filled ${Object.keys(updates).length} sections from Vault knowledge for "${dest}"`, { duration: 4000 });
          }
        }
      } catch (err) {
        // Fallback: legacy packing rules
        const subDests = proposal?.subDestinations || proposal?.sub_destinations || [];
        const subStr = Array.isArray(subDests) ? subDests.join(',') : subDests;
        fetch(`/api/packing-rules/match?destination=${encodeURIComponent(dest)}&sub_destinations=${encodeURIComponent(subStr)}`)
          .then(r => r.json())
          .then(res => {
            if (res?.rules?.length > 0) {
              const matched = res.rules.find(r => r.section_type === 'what_to_pack') || res.rules[0];
              if (matched?.content && !branding?.what_to_pack) {
                setBranding(s => ({ ...s, what_to_pack: matched.content }));
              }
            }
          })
          .catch(() => {});
      }
    })();

    return () => { isMounted = false; };
  }, [client?.destination, proposal?.destination]);
  // Note: intentionally omitting branding from deps to avoid re-triggering on every setBranding call


  const isStarter = !currentPlan || currentPlan.toLowerCase() === 'starter';

  const upd = (k) => (e) => setBranding((s) => ({ ...s, [k]: e.target.value }));
  const aiDraft = (field, label) => async () => {
    const currentText = branding?.[field] || '';
    if (!currentText) {
      toast.info(`Please type initial ${label} points first so AI can check grammar and enhance.`);
      return;
    }
    toast.info(`AI checking grammar and rewriting ${label} into luxury agency style...`);
    try {
      const res = await api.post('/api/enhance-text', {
        text: currentText,
        mode: field,
        destination: client?.destination || proposal?.destination || ''
      });
      if (res?.enhanced_text) {
        setBranding((s) => ({ ...s, [field]: res.enhanced_text }));
        toast.success(`Rewrote ${label} successfully!`);
      }
    } catch (err) {
      toast.error(`Failed to enhance ${label}`);
    }
  };

  const categories = ['All', 'Basic Tier', 'Luxury Magazine', 'Minimalist', 'Corporate', 'Honeymoon', 'Family & Adventure'];

  return (
    <div className="glass-card rounded-xl p-lg space-y-md" data-testid="step-branding">
      <h3 className="font-headline-sm text-headline-sm text-primary">Agency Branding & Template</h3>
      <div className="space-y-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <label className="font-label-md text-sm font-bold text-on-surface block">Template Architecture Gallery</label>
            <p className="text-xs text-on-surface-variant m-0">Select the design layout and typography system for this proposal's PDF export and live preview.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-700 font-bold text-[11px]">
            <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
            <span>Current Plan: {currentPlan}</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeCategory === cat ? 'bg-primary text-white shadow-sm scale-105' : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-1">
          {TEMPLATE_LIST.filter(tpl => {
            if (activeCategory === 'All') return true;
            const slug = tpl.slug || '';
            const catLower = (tpl.category || '').toLowerCase();
            let group = 'Luxury Magazine';
            if (tpl.tier === 'Basic' || ['classic', 'editorial', 'vibrant', 'modern', 'honeymoon', 'family', 'safari', 'alpine', 'zen', 'aegean', 'desert', 'nordic', 'tropic', 'maharaja', 'cosmopolitan', 'eco_sanctuary'].includes(slug)) {
              group = 'Basic Tier';
            } else if (catLower.includes('minimal') || catLower.includes('modern')) {
              group = 'Minimalist';
            } else if (catLower.includes('corporate') || catLower.includes('executive')) {
              group = 'Corporate';
            } else if (catLower.includes('honeymoon') || catLower.includes('romantic')) {
              group = 'Honeymoon';
            } else if (catLower.includes('family') || catLower.includes('adventure') || catLower.includes('safari')) {
              group = 'Family & Adventure';
            }
            return group === activeCategory || (activeCategory === 'Basic Tier' && group === 'Basic Tier');
          }).map(tpl => {
            const isSelected = (safeStr(branding?.template_style || 'classic') === tpl.slug) || (tpl.slug === 'classic' && !branding?.template_style);
            const slug = tpl.slug || '';
            const isBasic = tpl.tier === 'Basic' || ['classic', 'editorial', 'vibrant', 'modern', 'honeymoon', 'family', 'safari', 'alpine', 'zen', 'aegean', 'desert', 'nordic', 'tropic', 'maharaja', 'cosmopolitan', 'eco_sanctuary'].includes(slug);
            const isPremium = !isBasic;
            const isLocked = isPremium && isStarter;

            return (
              <div
                key={tpl.slug}
                onClick={() => {
                  if (isLocked) {
                    toast.error('Starter Plan allows Basic & Classic templates only. Upgrade to Professional or Enterprise in Settings to unlock Premium layouts!');
                    return;
                  }
                  setBranding(s => ({ ...s, template_style: tpl.slug }));
                }}
                className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-primary shadow-md bg-primary/5' : isLocked ? 'border-outline-variant/60 opacity-85 hover:border-amber-500/50 bg-surface-container-lowest' : 'border-outline-variant hover:border-primary/50 bg-surface-container-lowest'}`}
              >
                <div className="h-28 w-full overflow-hidden relative bg-slate-100">
                  <img src={tpl.thumbnail} alt={tpl.name} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isLocked ? 'grayscale-[30%]' : ''}`} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
                    {tpl.category}
                  </span>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow">
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-2xl text-amber-400">lock</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-amber-300">PRO Plan Only</span>
                    </div>
                  )}
                  {isPremium && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">{isLocked ? 'lock' : 'diamond'}</span> {isLocked ? 'PRO' : 'UNLOCKED'}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-sm text-on-surface m-0 mb-1 flex items-center justify-between">
                    {tpl.name}
                    {tpl.slug === 'editorial' && <span className="text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">New</span>}
                  </h4>
                  <p className="text-xs text-on-surface-variant line-clamp-2 m-0 leading-snug">{tpl.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
        <label className="flex flex-col gap-xs">
          <span className="font-label-md text-label-md text-on-surface">Primary Theme Accent Color</span>
          <div className="flex items-center gap-2">
            <input type="color" value={branding?.primary_color || '#1A365D'} onChange={upd('primary_color')} className="w-12 h-10 rounded cursor-pointer border border-outline-variant" />
            <span className="font-mono text-xs text-on-surface-variant">{branding?.primary_color || '#1A365D'}</span>
          </div>
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-label-md text-label-md text-on-surface">Secondary Theme Accent Color</span>
          <div className="flex items-center gap-2">
            <input type="color" value={branding?.secondary_color || '#C5A059'} onChange={upd('secondary_color')} className="w-12 h-10 rounded cursor-pointer border border-outline-variant" />
            <span className="font-mono text-xs text-on-surface-variant">{branding?.secondary_color || '#C5A059'}</span>
          </div>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <LogoUploader value={branding?.logo_url} onChange={(v) => setBranding((s) => ({ ...s, logo_url: v }))} label="Agency Logo" testid="brand-logo-uploader" folder="logos" />
        <LogoUploader value={branding?.cover_image_url} onChange={(v) => setBranding((s) => ({ ...s, cover_image_url: v }))} label="Cover Image" testid="brand-cover-uploader" folder="covers" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Agency Name" value={branding?.agency_name} onChange={upd('agency_name')} testid="brand-name" />
        <Field label="Address"     value={branding?.address}     onChange={upd('address')}     testid="brand-address" />
        <Field label="Contact Email" type="email" value={branding?.contact_email} onChange={upd('contact_email')} testid="brand-email" />
        <Field label="Contact Phone" value={branding?.contact_phone} onChange={upd('contact_phone')} testid="brand-phone" />
        <Field label="Website" value={branding?.website} onChange={upd('website')} testid="brand-website" />
        <Field label="Facebook"  value={branding?.social_facebook}  onChange={upd('social_facebook')}  testid="brand-fb" />
        <Field label="Instagram" value={branding?.social_instagram} onChange={upd('social_instagram')} testid="brand-ig" />
        <Field label="LinkedIn"  value={branding?.social_linkedin}  onChange={upd('social_linkedin')}  testid="brand-li" />
      </div>
      <div className="space-y-xs">
        <Textarea 
          label="Highlights" 
          value={branding?.highlights} 
          onChange={(e) => setBranding(s => ({ ...s, highlights: e.target.value, highlights_ai_drafted: false }))} 
          testid="brand-highlights" 
          placeholder="Bullet points of the trip's standout moments…" 
        />
        {branding?.highlights_ai_drafted && (
          <span className="text-[11px] font-semibold text-primary/80 flex items-center gap-xs px-xs" data-testid="highlights-ai-warning">
            <span className="material-symbols-outlined text-[14px] text-primary">auto_awesome</span>
            AI-drafted using your style profile, edit as needed
          </span>
        )}
      </div>
      <TextareaWithAI label="What's Included" value={branding?.inclusions} onChange={upd('inclusions')} testid="brand-inclusions" onAI={aiDraft('inclusions', 'inclusions')} />
      <TextareaWithAI label="What's Excluded" value={branding?.exclusions} onChange={upd('exclusions')} testid="brand-exclusions" onAI={aiDraft('exclusions', 'exclusions')} />
      <TextareaWithAI label="What to Pack (Packing & Trip Essentials)" value={branding?.what_to_pack} onChange={upd('what_to_pack')} testid="brand-what-to-pack" onAI={aiDraft('what_to_pack', 'what to pack')} />
      <TextareaWithAI label="Terms of Payment" value={branding?.terms_of_payment} onChange={upd('terms_of_payment')} testid="brand-terms" onAI={aiDraft('terms_of_payment', 'terms')} />
      
      {/* Custom Branding Fields */}
      <div className="pt-md border-t border-outline-variant space-y-3">
        <div className="flex justify-between items-center relative">
          <div>
            <h4 className="font-headline-sm text-sm font-bold text-primary m-0">Custom Branding Fields</h4>
            <p className="text-xs text-on-surface-variant m-0">Add badges, checklists, or partner images to appear on all proposals.</p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFieldMenu(v => !v)}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span> Add Field
              <span className="material-symbols-outlined text-[14px]">{showFieldMenu ? 'expand_less' : 'expand_more'}</span>
            </button>
            {showFieldMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                    const next = [...current, { id: Date.now() + Math.random(), label: '', value: '', type: 'text' }];
                    setBranding(s => ({ ...(s || {}), custom_fields: next }));
                    setShowFieldMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary/10 text-on-surface flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-base">badge</span>
                  <div>
                    <div className="font-bold">Text / Badge</div>
                    <div className="text-[10px] text-on-surface-variant">License, Tagline, Affiliation</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                    const next = [...current, { id: Date.now() + Math.random(), label: '', value: '', type: 'checklist' }];
                    setBranding(s => ({ ...(s || {}), custom_fields: next }));
                    setShowFieldMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary/10 text-on-surface flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-base">checklist</span>
                  <div>
                    <div className="font-bold">Checklist</div>
                    <div className="text-[10px] text-on-surface-variant">VIP amenities, Packing list</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                    const next = [...current, { id: Date.now() + Math.random(), label: '', value: '', type: 'image' }];
                    setBranding(s => ({ ...(s || {}), custom_fields: next }));
                    setShowFieldMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary/10 text-on-surface flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-base">image</span>
                  <div>
                    <div className="font-bold">Image / Seal</div>
                    <div className="text-[10px] text-on-surface-variant">Partner logo, Accreditation</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {(Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : []).map((cf, idx) => (
          <div key={cf.id || idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-2 w-full md:w-1/3">
              <span className="material-symbols-outlined text-primary text-base flex-shrink-0" title={`Type: ${cf.type || 'text'}`}>
                {cf.type === 'checklist' ? 'check_box' : cf.type === 'image' ? 'image' : 'badge'}
              </span>
              <input
                type="text"
                placeholder={cf.type === 'checklist' ? 'List Title (e.g. VIP Benefits)' : cf.type === 'image' ? 'Image Label (e.g. ASTA Seal)' : 'Label (e.g. IATA License)'}
                value={cf.label || ''}
                onChange={(e) => {
                  const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                  const next = current.map((item, i) => i === idx ? { ...item, label: e.target.value } : item);
                  setBranding(s => ({ ...(s || {}), custom_fields: next }));
                }}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex-1 w-full flex items-center gap-2">
              {cf.type === 'checklist' ? (
                <textarea
                  placeholder="Enter items separated by newlines..."
                  rows={2}
                  value={Array.isArray(cf.value) ? cf.value.join('\n') : (cf.value || '')}
                  onChange={(e) => {
                    const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                    const next = current.map((item, i) => i === idx ? { ...item, value: e.target.value } : item);
                    setBranding(s => ({ ...(s || {}), custom_fields: next }));
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                />
              ) : cf.type === 'image' ? (
                <div className="w-full flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Paste Image URL or upload..."
                    value={cf.value || ''}
                    onChange={(e) => {
                      const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                      const next = current.map((item, i) => i === idx ? { ...item, value: e.target.value } : item);
                      setBranding(s => ({ ...(s || {}), custom_fields: next }));
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                  />
                  {cf.value && <img src={cf.value} alt="preview" className="w-8 h-8 object-contain rounded border bg-white flex-shrink-0" />}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Value (e.g. 98-1-23456 or Member since 2020)"
                  value={cf.value || ''}
                  onChange={(e) => {
                    const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                    const next = current.map((item, i) => i === idx ? { ...item, value: e.target.value } : item);
                    setBranding(s => ({ ...(s || {}), custom_fields: next }));
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                />
              )}
              
              <button
                type="button"
                onClick={() => {
                  const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                  const next = current.filter((_, i) => i !== idx);
                  setBranding(s => ({ ...(s || {}), custom_fields: next }));
                }}
                className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors flex-shrink-0"
                title="Remove Field"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {customBlocks && customBlocks.length > 0 && (
        <div className="pt-md border-t border-outline-variant space-y-md">
          <h4 className="font-headline-sm text-headline-sm text-primary">Custom Sections</h4>
          {customBlocks.map((block, idx) => {
            const bId = String(block?.id || block?.label || idx);
            return (
              <div key={bId}>
                {block?.type === 'text' ? (
                   <Textarea label={block?.label || 'Custom'} value={branding?.[bId]} onChange={upd(bId)} testid={`brand-${bId}`} placeholder={`Enter content for ${block?.label || 'Custom'}...`} />
                ) : (
                   <LogoUploader value={branding?.[bId]} onChange={(v) => setBranding(s => ({ ...s, [bId]: v }))} label={block?.label || 'Custom Logo'} testid={`brand-${bId}`} folder="custom" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice & UPI Payment Linkage Banner */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 mt-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
          <div>
            <h5 className="text-xs font-bold text-on-surface m-0">Invoicing & UPI Payment Sync Active</h5>
            <p className="text-[11px] text-on-surface-variant m-0">
              Agency logo, primary colors, and UPI Pay Now VPA (`{branding?.upi_id || 'voyantatravel@okaxis'}`) are synchronized with your Settings for instant invoice generation.
            </p>
          </div>
        </div>
        <a href="/settings" target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 flex-shrink-0">
          <span>Edit Billing Settings</span>
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      </div>

      <p className="font-label-sm text-on-surface-variant">Branding is stored on this proposal and used in the preview & export. Defaults are inherited from your Agency Branding page.</p>
    </div>
  );
}

export default Step4Branding;
