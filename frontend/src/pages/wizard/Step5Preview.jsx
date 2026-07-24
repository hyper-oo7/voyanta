import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext.jsx';
import TemplateRenderer, { ALL as ALL_SECTIONS, ExportOptionsBar, THEMES } from '../../components/TemplateRenderer.jsx';
import { formatPrice } from '../../lib/currency.js';
import { useProposalStore } from '../../store/proposalStore.js';
import { incrementAnalytics } from '../../services/analyticsService.js';
import ImageUploadInput from '../../components/common/ImageUploadInput.jsx';
import { logActivity } from '../../services/activityLogService.js';
import { useBackendHealth } from '../../context/BackendHealthContext.jsx';
import { api } from '../../services/api.js';
import InlineStudioPopover from '../../components/common/InlineStudioPopover.jsx';
import { upsertClientFromProposal } from '../../services/crmService.js';
import { createProposal, updateProposal } from '../../services/proposalService.js';
import SmartContactCaptureModal from '../../components/common/SmartContactCaptureModal.jsx';
import { OFFLINE_GLOSSARY } from '../../lib/i18n.js';
import { getClimateClassification } from '../../lib/viClimateIntelligence.js';

function A4Preview({ children, style = 'classic', isInteractiveStudio, onStudioClick }) {
  const themeBg = THEMES[style]?.bg || '#ffffff';
  return (
    <div className="a4-host overflow-auto py-lg h-full flex flex-col items-center justify-start bg-gradient-to-b from-[#e9eef5] to-[#dfe5ee]" data-testid="a4-preview">
      <div 
        id="pdf-render-root" 
        style={{ backgroundColor: themeBg }} 
        className={`a4-paper shadow-2xl overflow-hidden w-[210mm] min-h-[297mm] rounded-md my-4 ${isInteractiveStudio ? 'cursor-pointer ring-4 ring-primary/50 transition-all' : ''}`}
        onClick={(e) => {
          if (!isInteractiveStudio) return;
          e.preventDefault();
          e.stopPropagation();
          let el = e.target;
          while (el && el.id !== 'pdf-render-root' && el.tagName.toLowerCase() !== 'body') {
            const tag = el.tagName.toLowerCase();
            if (['h1','h2','h3','h4','h5','h6','p','span','a','li','img','section'].includes(tag) || el.classList.contains('editorial-section') || el.classList.contains('card') || el.classList.contains('glass-card')) {
              if (onStudioClick) onStudioClick(el);
              return;
            }
            el = el.parentElement;
          }
          if (onStudioClick) onStudioClick(e.target);
        }}
        onMouseOver={(e) => {
          if (!isInteractiveStudio) return;
          const el = e.target;
          if (el && el.id !== 'pdf-render-root' && el !== e.currentTarget) {
            el.style.outline = '2px dashed #3b82f6';
            el.style.outlineOffset = '2px';
          }
        }}
        onMouseOut={(e) => {
          if (!isInteractiveStudio) return;
          const el = e.target;
          if (el && el.id !== 'pdf-render-root' && el !== e.currentTarget) {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }
        }}
      >
        {children}
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: ${themeBg} !important; }
          body * { visibility: hidden; }
          #pdf-render-root, #pdf-render-root * { visibility: visible; }
          #pdf-render-root { position: absolute; left: 0; top: 0; padding: 0; background: ${themeBg}; width: 210mm; min-height: 297mm; box-shadow: none !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function Step5Preview({ proposalId, branding, customBlocks, proposalName, onAddCustomBlock }) {
  const toast = useToast();
  const { isHealthy } = useBackendHealth();
  const { proposal, items, saveDraftBackground, setProposal } = useProposalStore();
  const [localCustomBlocks, setLocalCustomBlocks] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('voyanta_global_custom_blocks') || 'null');
      if (stored && Array.isArray(stored) && stored.length > 0) return stored;
    } catch {}
    return customBlocks || [];
  });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustom, setNewCustom] = useState({ label: '', type: 'text', content: '' });
  const [isInteractiveStudio, setIsInteractiveStudio] = useState(false);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const shareDropdownRef = useRef(null);
  const [studioTarget, setStudioTarget] = useState(null);
  const [smartContact, setSmartContact] = useState(null);

  // Close share dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target)) {
        setShareDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [warnings, setWarnings] = useState([]);
  const [showWarnings, setShowWarnings] = useState(false);

  const [sequenceFlags, setSequenceFlags] = useState([]);
  const [showSequenceFlags, setShowSequenceFlags] = useState(false);
  const [isValidatingSequence, setIsValidatingSequence] = useState(false);

  // Trigger validation check automatically when the preview page loads
  useEffect(() => {
    if (!proposalId) return;

    let isMounted = true;
    (async () => {
      try {
        let token = null;
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
          if (session?.access_token) token = session.access_token;
        } catch {}

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/proposals/${proposalId}/validate`, {
          method: 'POST',
          headers
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.warnings && data.warnings.length > 0) {
            setWarnings(data.warnings);
            setShowWarnings(true);
          }
        }
      } catch (err) {
        console.error("Failed to run proposal validation check:", err);
      }
    })();

    return () => { isMounted = false; };
  }, [proposalId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`voyanta_overrides_${proposalId}`) || '{}');
        for (const [key, val] of Object.entries(saved)) {
          const el = document.getElementById(key) || document.querySelector(`[data-testid="${key}"]`) || (val.selector ? document.querySelector(val.selector) : null);
          if (el) {
            if (val.type === 'text') {
              if (val.text !== undefined) el.innerText = val.text;
              if (val.color) el.style.color = val.color;
              if (val.fontSize) el.style.fontSize = val.fontSize;
              if (val.fontWeight) el.style.fontWeight = val.fontWeight;
              if (val.textAlign) el.style.textAlign = val.textAlign;
            } else if (val.type === 'image') {
              if (el.tagName.toLowerCase() === 'img') el.src = val.src;
              else el.style.backgroundImage = `url("${val.src}")`;
              if (val.objectFit) el.style.objectFit = val.objectFit;
              if (val.borderRadius) el.style.borderRadius = val.borderRadius;
            } else if (val.type === 'section') {
              if (val.backgroundColor) el.style.backgroundColor = val.backgroundColor;
              if (val.padding) el.style.padding = val.padding;
            }
          }
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [proposalId, branding]);

  // Pull database overrides into localStorage for offline consistency
  useEffect(() => {
    if (!proposalId) return;
    try {
      const dbOverrides = proposal?.preferences?.overrides;
      if (dbOverrides && Object.keys(dbOverrides).length > 0) {
        const localKey = `voyanta_overrides_${proposalId}`;
        const local = JSON.parse(localStorage.getItem(localKey) || '{}');
        const merged = { ...dbOverrides, ...local };
        localStorage.setItem(localKey, JSON.stringify(merged));
      }
    } catch {}
  }, [proposalId, proposal?.preferences?.overrides]);

  const [include, setInclude] = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('voyanta_default_template_prefs') || 'null');
      if (prefs && prefs.include_sections) return { ...ALL_SECTIONS, ...prefs.include_sections };
    } catch {}
    return ALL_SECTIONS;
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [style, setStyle] = useState(() => {
    return proposal?.preferences?.template_style || branding?.template_style || 'classic';
  });
  const [generating, setGenerating] = useState(false);

  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('voyanta_default_template_prefs') || 'null');
      if (prefs && Array.isArray(prefs.section_order) && prefs.section_order.length > 0) return prefs.section_order;
    } catch {}
    const base = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];
    if (localCustomBlocks) localCustomBlocks.forEach(cb => base.push(cb.id));
    return base;
  });

  const json = useMemo(() => {
    if (!proposal) return null;
    const grouped = {};
    for (const it of items) {
      const k = (it.kind || 'custom').toLowerCase();
      (grouped[k] ||= []).push(it);
    }
    const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    return {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      agency_id: proposal.agency_id || 'DEFAULT',
      proposal,
      items_by_kind: grouped,
      items,
      totals: { subtotal: total, currency: proposal.currency || 'INR' },
    };
  }, [proposal, items]);

  const [viSeasonalAdvisories, setViSeasonalAdvisories] = useState([]);

  useEffect(() => {
    const dest = proposal?.destination || proposal?.brief?.destination || '';
    const startDate = proposal?.start_date || proposal?.brief?.start_date || '';
    if (!dest || !startDate) {
      setViSeasonalAdvisories([]);
      return;
    }

    try {
      const climate = getClimateClassification(dest, startDate);
      const advisories = [];
      if (climate.profileNotes) advisories.push(climate.profileNotes);
      if (climate.seasonName) advisories.push(`Expected Season: ${climate.seasonName}`);
      setViSeasonalAdvisories(advisories);
    } catch (err) {
      console.error("Failed to set VI seasonal rules:", err);
      setViSeasonalAdvisories([]);
    }
  }, [proposal?.destination, proposal?.start_date]);

  // Auto-sync template settings (style, selections, custom sections, order) to Supabase database
  useEffect(() => {
    if (!proposalId) return;
    setProposal(p => {
      const currentPrefs = p?.preferences || {};
      if (
        currentPrefs.template_style === style &&
        JSON.stringify(currentPrefs.include_sections) === JSON.stringify(include) &&
        JSON.stringify(currentPrefs.section_order) === JSON.stringify(sectionOrder) &&
        JSON.stringify(currentPrefs.custom_blocks) === JSON.stringify(localCustomBlocks)
      ) {
        return p;
      }
      return {
        ...p,
        preferences: {
          ...currentPrefs,
          template_style: style,
          include_sections: include,
          section_order: sectionOrder,
          custom_blocks: localCustomBlocks
        }
      };
    });
    saveDraftBackground().catch(() => {});
  }, [style, include, sectionOrder, localCustomBlocks, proposalId, setProposal, saveDraftBackground]);

  useEffect(() => {
    if (customBlocks && customBlocks.length > 0) {
      setLocalCustomBlocks(prev => {
        const merged = [...prev];
        customBlocks.forEach(cb => {
          if (!merged.some(m => m.id === cb.id)) merged.push(cb);
        });
        try { localStorage.setItem('voyanta_global_custom_blocks', JSON.stringify(merged)); } catch {}
        return merged;
      });
    }
  }, [customBlocks]);

  useEffect(() => {
    if (!proposalId && typeof saveDraftBackground === 'function') {
      saveDraftBackground().catch(() => {});
    }
  }, [proposalId, saveDraftBackground]);

  const autoGenerateOverview = useCallback(() => {
    const dest = proposal?.destination || proposal?.preferences?.client?.destination || 'your destination';
    const daysCount = proposal?.itinerary?.days?.length || proposal?.preferences?.client?.duration_days || 5;
    const nightsCount = Math.max(0, daysCount - 1);
    const who = proposal?.preferences?.client?.group_type || 'Travelers';
    const category = proposal?.preferences?.client?.tour_category || proposal?.preferences?.client?.tour_type || 'Curated';
    
    const cities = Array.from(new Set(
      (proposal?.itinerary?.days || [])
        .map(d => d.title || d.destination || '')
        .filter(Boolean)
        .map(t => t.split('-')[0].trim())
    )).slice(0, 4);
    const citiesStr = cities.length > 0 ? ` exploring highlights across ${cities.join(', ')}` : '';

    const text = `Embark on an exclusive ${daysCount}-day, ${nightsCount}-night ${category.toLowerCase()} journey through ${dest}${citiesStr}, tailored specifically for ${who.toLowerCase()}. This meticulously crafted itinerary combines immersive cultural encounters, handpicked luxury accommodations, and seamless private transfers. Every day is thoughtfully paced to provide the perfect balance of discovery, relaxation, and authentic local experiences.`;
    setProposal(p => ({ ...p, overview: text }));
    toast.success('✨ Destination overview auto-generated!');
    saveDraftBackground().catch(() => {});
  }, [proposal, setProposal, saveDraftBackground]);

  useEffect(() => {
    const targetStyle = proposal?.preferences?.template_style || branding?.template_style;
    if (targetStyle && style !== targetStyle) {
      setStyle(targetStyle);
    }
  }, [proposal?.preferences?.template_style, branding?.template_style]);

  useEffect(() => {
    const handleSaveClicked = () => {
      setShowTemplatePrompt(true);
    };
    window.addEventListener('voyanta:step7-save-clicked', handleSaveClicked);
    return () => window.removeEventListener('voyanta:step7-save-clicked', handleSaveClicked);
  }, []);

  const handleConfirmSaveTemplate = () => {
    try {
      const templatePrefs = {
        template_style: style,
        include_sections: include,
        section_order: sectionOrder,
        saved_at: new Date().toISOString()
      };
      localStorage.setItem('voyanta_default_template_prefs', JSON.stringify(templatePrefs));

      const galleryStr = localStorage.getItem('voyanta_templates_gallery') || '[]';
      const gallery = JSON.parse(galleryStr);
      gallery.unshift({
        id: crypto.randomUUID(),
        title: `${proposal?.destination || 'Custom'} (${style.toUpperCase()}) Template`,
        description: `Saved with ${Object.keys(include).filter(k => include[k]).length} active sections.`,
        style,
        include,
        sectionOrder,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('voyanta_templates_gallery', JSON.stringify(gallery));
      toast.success('Template saved to Gallery! Will open by default with these section preferences.');
    } catch (err) {
      toast.error('Failed to save template preferences.');
    }
    setShowTemplatePrompt(false);
  };

  const onDownloadJson = () => {
    if (!json) return;
    const envelope = { ...json, presentation: { style, include }, branding };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `proposal-${json.proposal?.name || proposalId}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('Proposal JSON exported');
  };

  const handleCreateCustomSection = () => {
    if (!newCustom.label.trim()) {
      toast.error('Please enter a title for the custom section');
      return;
    }
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const created = { id, label: newCustom.label.trim(), type: newCustom.type, content: newCustom.content };
    setLocalCustomBlocks(prev => {
      const next = [...prev, created];
      try { localStorage.setItem('voyanta_global_custom_blocks', JSON.stringify(next)); } catch {}
      return next;
    });
    if (typeof onAddCustomBlock === 'function') {
      onAddCustomBlock(created);
    }
    setInclude(prev => ({ ...prev, [id]: true }));
    setSectionOrder(prev => [...prev, id]);
    setNewCustom({ label: '', type: 'text', content: '' });
    setShowAddCustom(false);
    toast.success(`Section "${created.label}" added!`);
  };

  const handleValidateSequence = async () => {
    if (!proposalId) return;
    
    setIsValidatingSequence(true);
    try {
      const st = useProposalStore.getState();
      const days = st.proposal?.itinerary?.days || [];
      
      let token = null;
      try {
        const supa = (await import('../../lib/supabaseClient.js')).supabase;
        const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
        if (session?.access_token) token = session.access_token;
      } catch {}

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/proposals/validate-sequence', {
        method: 'POST',
        headers,
        body: JSON.stringify({ days })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.flags) {
          setSequenceFlags(data.flags);
          setShowSequenceFlags(true);
          if (data.flags.length === 0) {
            toast.success("✨ Itinerary flow and pacing check completed successfully! No issues flagged.");
          } else {
            toast.info(`VI flagged ${data.flags.length} pacing/sequence recommendations.`);
          }
        }
      }
    } catch (err) {
      console.error("Failed to run sequence validation:", err);
      toast.error("Failed to execute sequence validation check.");
    } finally {
      setIsValidatingSequence(false);
    }
  };

  const onGeneratePdf = async () => {
    if (!proposalId || generating) return;
    const currentPlan = localStorage.getItem('voyanta_active_plan') || 'Starter';
    if (currentPlan === 'Starter') {
      const count = parseInt(localStorage.getItem('voyanta_starter_pdf_count') || '0', 10);
      if (count >= 10) {
        toast.error('Starter Plan Limit Reached: You have used your 10 monthly PDF downloads. Upgrade to Professional or Enterprise in Settings.');
        return;
      }
      localStorage.setItem('voyanta_starter_pdf_count', String(count + 1));
    }
    setGenerating(true);
    toast.info('⏳ PDF Generation in Process... Preparing high-definition document layouts and typography, please hold on.', { duration: 3000 });
    try {
      let localStorageDump = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) localStorageDump[k] = localStorage.getItem(k);
        }
      } catch {}

      const renderRoot = document.getElementById('pdf-render-root');
      let bodyPayload = { proposal_id: proposalId, name: proposalName || 'proposal', style: style, local_storage: localStorageDump };
      if (renderRoot) {
        const rootClone = renderRoot.cloneNode(true);
        rootClone.classList.remove('aspect-[210/297]', 'h-[80vh]', 'min-h-[auto]', 'w-auto', 'overflow-hidden');
        rootClone.classList.add('w-[210mm]', 'min-h-[297mm]');
        rootClone.style.height = 'auto';
        rootClone.style.overflow = 'visible';
        rootClone.style.aspectRatio = 'auto';
        rootClone.style.backgroundColor = THEMES[style]?.bg || '#ffffff';
        rootClone.querySelectorAll('section, .editorial-section').forEach(sec => {
          sec.style.display = 'block';
          sec.style.minHeight = 'auto';
        });

        const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(el => {
            if (el.tagName.toLowerCase() === 'link' && el.href) {
              const clone = el.cloneNode();
              clone.setAttribute('href', el.href);
              return clone.outerHTML;
            }
            return el.outerHTML;
          })
          .join('\n');
        const themeBg = THEMES[style]?.bg || '#ffffff';
        const themeText = THEMES[style]?.text || '#000000';
        const customPrintStyles = `<style>
          @page { size: A4; margin: 0; }
          body, html, #pdf-render-root { margin: 0; padding: 0; background: ${themeBg} !important; color: ${themeText} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 100% !important; height: auto !important; min-height: 100% !important; overflow: visible !important; aspect-ratio: auto !important; }
          html.dark #pdf-render-root, html.dark #pdf-render-root * { color-scheme: light !important; }
          .proposal-document, .proposal-document section { display: block !important; break-before: auto !important; page-break-before: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          h1, h2, h3, h4, .editorial-section h2, .editorial-section h3 { break-after: avoid !important; page-break-after: avoid !important; }
          .break-inside-avoid, .page-break-inside-avoid, li.break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #ffffff !important; color: #000000 !important; }
            .no-print { display: none !important; }
          }
        </style>`;
        const baseTag = `<base href="${window.location.origin}/">`;
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${baseTag}${headStyles}${customPrintStyles}</head><body style="background-color: ${themeBg}; color: ${themeText}; margin: 0; padding: 0;">${rootClone.outerHTML}</body></html>`;
        bodyPayload = { html: fullHtml, proposal_id: proposalId, name: proposalName || 'proposal', style: style, local_storage: localStorageDump };
      }

      const blob = await api.post('/api/pdf/generate', bodyPayload, { responseType: 'blob', timeout: 60000 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url;
      a.download = `proposal-${proposalName || proposalId}.pdf`;
      document.body.appendChild(a); 
      a.click(); 
      a.remove(); 
      URL.revokeObjectURL(url);
      incrementAnalytics('download', proposalId);
      logActivity('pdf', `Generated PDF for proposal "${proposalName || proposalId}"`, proposal?.client_name || 'Client');
      setProposal({ status: 'Sent' });
      try {
        const pStore = useProposalStore.getState();
        const payload = pStore.buildPayload();
        const pid = proposalId || pStore.activeId || payload.id;
        if (pid) {
          await updateProposal(pid, { ...payload, status: 'Sent' });
        } else {
          const created = await createProposal({ ...payload, status: 'Sent' });
          pStore.setActiveId(created.id);
        }
        await upsertClientFromProposal({
          ...pStore.client,
          ...proposal,
          ...payload,
          status: 'Sent',
          name: proposalName || proposal?.name || proposalId
        });
      } catch (err) {
        console.warn('Sync error after PDF generation:', err);
      }
      window.dispatchEvent(new CustomEvent('voyanta:proposals-updated'));
      window.dispatchEvent(new CustomEvent('voyanta:analytics-updated'));
      toast.success('PDF generated successfully');
    } catch (e) {
      console.error('PDF generation error:', e);
      toast.error(`Failed to generate PDF: ${e.message || 'Service unreachable'}`);
    } finally {
      setGenerating(false);
    }
  };

  const onPrint = () => window.print();

  if (!proposalId) return <div className="glass-card p-xl rounded-xl text-center text-on-surface-variant" data-testid="preview-no-proposal"><span className="material-symbols-outlined animate-spin text-xl inline-block mr-2 align-middle">progress_activity</span>Auto-saving draft & preparing preview…</div>;
  if (!json) return <div className="glass-card p-xl rounded-xl text-center">Building preview…</div>;

  const merged = { ...json, proposal: { ...json.proposal, preferences: { ...(json.proposal?.preferences || {}), branding: { ...(json.proposal?.preferences?.branding || {}), ...branding } } } };

  return (
    <div className="h-full flex flex-col space-y-md" data-testid="step-preview">
      <div className="glass-card relative z-30 px-md py-sm rounded-xl flex items-center justify-between gap-md flex-wrap no-print border border-outline-variant/80 shadow-sm bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="flex items-center gap-2 flex-wrap">


          {/* VI Auto Title */}
          <button type="button" onClick={async () => {
            const dest = json?.proposal?.destination || 'Destination';
            const tType = json?.proposal?.preferences?.tour_type || 'Luxury';
            const gType = json?.proposal?.preferences?.group_type || '';
            const tCat = json?.proposal?.preferences?.tour_category || '';
            const duration = json?.proposal?.itinerary?.days?.length || 7;
            toast.info('Generating luxury title via VI...');
            try {
              const res = await api.post('/api/generate-title', {
                destination: dest,
                tour_type: tType,
                group_type: gType,
                tour_category: tCat,
                duration: duration
              });
              if (res?.title) {
                setProposal({ ...proposal, name: res.title });
                toast.success('Generated title: ' + res.title);
              }
            } catch (err) {
              toast.error('Failed to generate title');
            }
          }}
          title="VI Auto-Title based on destination, tour type & who's travelling"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 rounded-lg font-bold text-xs transition-colors cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>✨ VI Title</span>
          </button>

          {/* VI Proposal Review */}
          <button 
            type="button" 
            onClick={handleValidateSequence} 
            disabled={isValidatingSequence}
            data-testid="ai-itinerary-check"
            title="VI Proposal Review"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 hover:bg-purple-500/20 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isValidatingSequence ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">verified</span>
            )}
            <span>🔍 VI Review</span>
          </button>
        </div>

      {viSeasonalAdvisories.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-md shadow-sm space-y-xs no-print my-sm">
          <div className="flex items-center gap-xs text-amber-900 font-bold font-label-md">
            <span className="material-symbols-outlined text-amber-600">verified_user</span>
            VI Review: Seasonal Climate Advisory for {proposal?.destination || proposal?.brief?.destination || 'Destination'}
          </div>
          <ul className="divide-y divide-amber-200/60">
            {viSeasonalAdvisories.map((rule, idx) => (
              <li key={idx} className="py-xs flex items-start gap-xs text-xs text-amber-800">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 ${rule.rule_type === 'avoid' ? 'bg-red-100 text-red-700' : rule.rule_type === 'prefer' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                  {rule.rule_type}
                </span>
                <span className="flex-1 font-medium">{rule.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
          {/* Editor Mode */}
          <button type="button" onClick={() => setIsInteractiveStudio(!isInteractiveStudio)} data-testid="toggle-wysiwyg"
            className={`px-3 py-1.5 border rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${isInteractiveStudio ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50'}`}>
            <span className="material-symbols-outlined text-[16px]">{isInteractiveStudio ? 'edit_square' : 'edit'}</span>
            <span>{isInteractiveStudio ? '✏️ Editor Active' : '✏️ Editor Mode'}</span>
          </button>

          {/* Edit Web View */}
          <button 
            type="button" 
            onClick={() => window.open(`/view/${proposal?.share_token || 'demo'}`, '_blank')} 
            className="px-3 py-1.5 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>Edit Web View</span>
          </button>

          {/* Customize Sections */}
          <button type="button" onClick={() => setExportOpen(true)} data-testid="open-export-modal"
            className="px-3 py-1.5 border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Customize Sections</span>
          </button>

          {/* Share / Export with high Z-Index */}
          <div className="relative" ref={shareDropdownRef}>
            <button 
              type="button" 
              onClick={() => setShareDropdownOpen(!shareDropdownOpen)}
              className="px-4 py-1.5 bg-primary text-on-primary rounded-lg font-bold text-xs hover:opacity-90 flex items-center gap-1 shadow-md transition-all border-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Share / Export</span>
              <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
            </button>
            
            {shareDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl z-[9999] py-1.5 overflow-hidden animate-fade-in font-sans">
                <button 
                  type="button"
                  onClick={() => {
                    setShareDropdownOpen(false);
                    setProposal({ ...proposal, status: 'Sent' });
                    saveDraftBackground();
                    const url = `${window.location.origin}/view/${proposal?.share_token || 'demo'}?mode=client`;
                    navigator.clipboard.writeText(url);
                    toast.success('Client Web View URL copied to clipboard!');
                    window.open(url, '_blank');
                  }}
                  className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">public</span>
                  <div>
                    <div className="font-semibold text-xs text-on-surface">Client Web View</div>
                    <div className="text-[10px] text-on-surface-variant">Copy link & open customer view</div>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShareDropdownOpen(false);
                    onGeneratePdf();
                  }}
                  disabled={generating}
                  className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-rose-600 text-[20px]">picture_as_pdf</span>
                  <div>
                    <div className="font-semibold text-xs text-on-surface">{generating ? 'Generating PDF...' : 'Download PDF (A4 Print)'}</div>
                    <div className="text-[10px] text-on-surface-variant">Export high-res proposal document</div>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShareDropdownOpen(false);
                    setProposal({ ...proposal, status: 'Sent' });
                    saveDraftBackground();
                    const destName = proposal?.destination || proposal?.preferences?.client?.destination || 'your trip';
                    const clientUrl = `${window.location.origin}/view/${proposal?.share_token || 'demo'}?mode=client`;
                    const text = `Hi! 🌟 We have curated a custom travel proposal for ${destName}.\n\nYou can view the interactive live proposal, translate languages, and accept or request modifications right here:\n👉 ${clientUrl}\n\n(We have also attached your detailed A4 PDF itinerary for your records. Let us know if you need any customizations!)`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">chat</span>
                  <div>
                    <div className="font-semibold text-xs text-on-surface">Share via WhatsApp</div>
                    <div className="text-[10px] text-on-surface-variant">Send interactive link & PDF note</div>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShareDropdownOpen(false);
                    setProposal({ ...proposal, status: 'Sent' });
                    saveDraftBackground();
                    const destName = proposal?.destination || proposal?.preferences?.client?.destination || 'Your Trip';
                    const clientUrl = `${window.location.origin}/view/${proposal?.share_token || 'demo'}?mode=client`;
                    const subject = `Your Exclusive Travel Proposal: ${destName}`;
                    const body = `Hi,\n\nWe are delighted to share your custom travel proposal for ${destName}.\n\nYou can explore your complete interactive itinerary, view inclusions/exclusions, and accept or request modifications directly online:\n${clientUrl}\n\nWe have also prepared an A4 PDF document for offline viewing and printing.\n\nPlease feel free to reply to this email with any questions or special preferences.\n\nWarm regards,\n${branding?.agency_name || 'Voyanta Travel Team'}`;
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
                  }}
                  className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer"
                >
                  <span className="material-symbols-outlined text-amber-600 text-[20px]">mail</span>
                  <div>
                    <div className="font-semibold text-xs text-on-surface">Share via Email</div>
                    <div className="text-[10px] text-on-surface-variant">Draft pre-filled email with link</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isInteractiveStudio && (
        <div className="bg-primary text-on-primary px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-between shadow-lg mb-4 animate-fade-in no-print">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg animate-bounce">magic_button</span>
            <span>🎨 WYSIWYG Interactive Studio Active — Click any text, price, image, or section below to edit inline!</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setIsInteractiveStudio(false); setStudioTarget(null); }} className="px-3 py-1 bg-white text-primary rounded-lg font-bold hover:bg-white/90 transition-colors">
              ✕ Exit Studio
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex flex-row overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        
        {/* Left Side: Scrollable Document Preview Area */}
        <div className="flex-1 overflow-auto flex flex-col relative h-full">
          {showWarnings && warnings.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-lg py-md flex items-start gap-md no-print animate-fade-in">
              <span className="material-symbols-outlined text-amber-600 mt-xs">warning</span>
              <div className="flex-1 space-y-xs">
                <h4 className="font-label-md font-bold text-amber-900">Itinerary Validation Warnings</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-amber-850">
                  {warnings.map((w, idx) => (
                    <li key={idx} className="font-medium">{w.message}</li>
                  ))}
                </ul>
              </div>
              <button 
                type="button"
                onClick={() => setShowWarnings(false)} 
                className="text-amber-500 hover:text-amber-700 p-1 inline-flex items-center justify-center rounded-full hover:bg-amber-100/50"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}
          
          <A4Preview style={style} isInteractiveStudio={isInteractiveStudio} onStudioClick={(el) => setStudioTarget(el)}>
            <TemplateRenderer style={style} data={merged} include={include} order={sectionOrder} customBlocks={localCustomBlocks} viewMode="document" branding={branding} />
          </A4Preview>
        </div>

        {/* Right Side: VI Pacing & Sequence Analysis Panel */}
        {showSequenceFlags && (
          <div className="w-[340px] border-l border-outline-variant bg-surface-container-low flex flex-col no-print animate-fade-in" data-testid="sequence-warnings">
            <div className="p-md border-b border-outline-variant flex items-center justify-between bg-surface-container-high">
              <div className="flex items-center gap-2 text-purple-900">
                <span className="material-symbols-outlined text-[20px]">travel_explore</span>
                <span className="font-bold text-xs uppercase tracking-wider">VI Pacing & Sequence</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowSequenceFlags(false)} 
                className="text-on-surface-variant hover:bg-surface-container-lowest w-7 h-7 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer border-none"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-md space-y-md font-sans">
              {sequenceFlags.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant space-y-3">
                  <span className="material-symbols-outlined text-[36px] text-emerald-600">check_circle</span>
                  <p className="font-bold text-xs">Itinerary flows perfectly!</p>
                  <p className="text-[11px] leading-relaxed text-on-surface-variant/80">No pacing anomalies or sequence issues detected by Voyanta Intelligence.</p>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-on-surface-variant leading-relaxed">
                    VI analyzed your itinerary flow. Recommendations details:
                  </div>
                  {sequenceFlags.map((flag) => (
                    <div key={flag.id} className="p-md rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-purple-700 text-[16px] mt-[1px]">flag</span>
                        <div className="text-xs font-bold text-purple-950 leading-snug">{flag.message}</div>
                      </div>
                      {flag.fix && (
                        <div className="pl-5 border-l border-purple-200/80 ml-2">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-purple-700">Recommended Fix</span>
                          <p className="text-[11px] text-purple-850 m-0 leading-relaxed mt-0.5">{flag.fix}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
        {isInteractiveStudio && studioTarget && (
          <InlineStudioPopover 
            target={studioTarget} 
            onClose={() => setStudioTarget(null)} 
            branding={branding} 
            setBranding={(fnOrVal) => {
              const st = useProposalStore.getState();
              const next = typeof fnOrVal === 'function' ? fnOrVal(st.branding) : fnOrVal;
              st.setBranding(next);
              if (typeof st.saveDraftBackground === 'function') st.saveDraftBackground().catch(()=>{});
            }} 
            onApplyOverride={(elKey, override) => {
              try {
                const currentOverrides = JSON.parse(localStorage.getItem(`voyanta_overrides_${proposalId}`) || '{}');
                currentOverrides[elKey] = override;
                localStorage.setItem(`voyanta_overrides_${proposalId}`, JSON.stringify(currentOverrides));
                if (typeof saveDraftBackground === 'function') saveDraftBackground().catch(()=>{});
              } catch {}
            }}
          />
        )}
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm no-print"
             data-testid="export-modal" onClick={(e) => e.target === e.currentTarget && setExportOpen(false)}>
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant p-lg space-y-md max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-primary">Choose sections to include</h3>
              <button onClick={() => setExportOpen(false)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low" data-testid="export-modal-close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ExportOptionsBar value={include} onChange={setInclude} order={sectionOrder} setOrder={setSectionOrder} customBlocks={localCustomBlocks} />
            <div className="pt-4 border-t border-outline-variant space-y-3">
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/60 space-y-2.5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h4 className="font-headline-sm text-sm font-bold text-primary m-0 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">description</span>
                    Destination Overview
                  </h4>
                  <button
                    type="button"
                    onClick={autoGenerateOverview}
                    className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    ✨ Auto-Generate Overview
                  </button>
                </div>
                <textarea
                  value={proposal?.overview || ''}
                  onChange={(e) => {
                    setProposal({ ...proposal, overview: e.target.value });
                  }}
                  onBlur={() => saveDraftBackground().catch(() => {})}
                  placeholder="Click '✨ Auto-Generate Overview' or type your custom destination introduction here..."
                  rows="3"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
            <div className="pt-4 border-t border-outline-variant">
              {!showAddCustom ? (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="w-full py-3 px-4 border-2 border-dashed border-primary/40 text-primary hover:border-primary hover:bg-primary/5 rounded-xl font-label-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  Add Custom Section (Text, Image, or List)
                </button>
              ) : (
                <div className="bg-surface-container p-4 rounded-xl space-y-4 border border-outline-variant">
                  <div className="flex justify-between items-center">
                    <h4 className="font-headline-sm text-sm font-bold text-primary m-0">Create Custom Section</h4>
                    <button type="button" onClick={() => setShowAddCustom(false)} className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancel</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Section Title</label>
                      <input
                        type="text"
                        value={newCustom.label}
                        onChange={(e) => setNewCustom({ ...newCustom, label: e.target.value })}
                        placeholder="e.g. VIP Benefits, Important Notice"
                        className="w-full px-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Content Type</label>
                      <select
                        value={newCustom.type}
                        onChange={(e) => setNewCustom({ ...newCustom, type: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface"
                      >
                        <option value="text">Paragraph / Text</option>
                        <option value="list">Bullet List</option>
                        <option value="image">Image (Upload or URL)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    {newCustom.type === 'image' ? (
                      <ImageUploadInput
                        label="Section Image"
                        value={newCustom.content}
                        onChange={(val) => setNewCustom({ ...newCustom, content: val })}
                        placeholder="https://example.com/image.jpg or upload..."
                      />
                    ) : (
                      <>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                          {newCustom.type === 'list' ? 'List Items (one item per line)' : 'Section Content'}
                        </label>
                        <textarea
                          value={newCustom.content}
                          onChange={(e) => setNewCustom({ ...newCustom, content: e.target.value })}
                          placeholder={newCustom.type === 'list' ? 'Complimentary Airport Transfer\nPrivate Butler Service\nExclusive Spa Access' : 'Enter detailed content here...'}
                          rows="3"
                          className="w-full px-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface"
                        />
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateCustomSection}
                    className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Save Section & Add to Proposal
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-md">
              <button type="button" onClick={() => setInclude(ALL_SECTIONS)} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="export-select-all">Select all</button>
              <button type="button" onClick={() => setExportOpen(false)} className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90" data-testid="export-apply">Apply</button>
            </div>
          </div>
        </div>
      )}


      {showTemplatePrompt && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-xl animate-fade-in" onClick={() => setShowTemplatePrompt(false)}>
          <div className="bg-surface border border-outline-variant w-full max-w-md rounded-3xl p-xl shadow-2xl flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-lg">
              <span className="material-symbols-outlined text-[32px]">bookmark_add</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-on-surface mb-sm">Save Template for Future?</h3>
            <p className="font-body-md text-sm text-on-surface-variant mb-xl leading-relaxed">
              Would you like to save this layout ({style.toUpperCase()} style with {Object.keys(include).filter(k => include[k]).length} selected sections) to your Template Gallery? Next time you create a proposal, it will open by default with these section preferences.
            </p>
            <div className="flex gap-md w-full">
              <button 
                type="button"
                onClick={() => {
                  setShowTemplatePrompt(false);
                  toast.success('Proposal saved without template preferences.');
                }}
                className="flex-1 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md rounded-xl border border-outline-variant transition-all"
              >
                No, Just Save
              </button>
              <button 
                type="button"
                onClick={handleConfirmSaveTemplate}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-label-md rounded-xl shadow-lg shadow-primary/30 transition-all font-bold"
              >
                Yes, Save Template
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {smartContact && (
        <SmartContactCaptureModal
          isOpen={true}
          onClose={() => setSmartContact(null)}
          {...smartContact}
        />
      )}
    </div>
  );
}

export default Step5Preview;
