import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';

import ImportModal from '../components/ImportModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import {
  fetchProposalById, createProposal, updateProposal,
} from '../services/proposalService.js';
import { hotelsService, flightsService, activitiesService, itinerariesService } from '../services/resourceService.js';
import { listItems, addItem, removeItem, updateItem } from '../services/proposalItemService.js';
import { supabase } from '../lib/supabaseClient.js';
import { DEFAULT_COUNTRY } from '../lib/countries.js';

// Import Wizard Steps
import { ProgressBar, STEPS } from './wizard/ProgressBar.jsx';
import { Step1Client } from './wizard/Step1Client.jsx';
import { Step2Itinerary } from './wizard/Step2Itinerary.jsx';
import { ResourceStep } from './wizard/ResourcePicker.jsx';
import { Step5Costing } from './wizard/Step5Costing.jsx';
import { Step6Branding } from './wizard/Step6Branding.jsx';
import { Step7Preview } from './wizard/Step7Preview.jsx';

export default function ProposalWizard() {
  const wrapperRef = useRef(null);
  const step1Ref = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { signOut, isDemo, user } = useAuth();
  const { setActiveId } = useProposalBuilder() || {};

  const idParam   = params.get('id') || '';
  const stepParam = Math.max(1, Math.min(5, parseInt(params.get('step') || '1', 10) || 1));

  const [proposal, setProposal] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itineraries, setItineraries] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importResource, setImportResource] = useState('');

  const [client, setClient] = useState({
    customer_name: '', phone: '', country: DEFAULT_COUNTRY, email: '',
    destination: '',
    date_mode: 'dates', // 'dates' or 'days'
    start_date: '', end_date: '',
    duration_days: 1, duration_nights: 1,
    arrival_city: '', arrival_airport: '',
    departure_city: '', departure_airport: '',
    num_adults: 1, num_children: 0, budget: '', special_notes: '',
    itinerary_id: '',
    tour_type: params.get('tour_type') || '',
  });

  useEffect(() => {
    (async () => {
      try {
        const list = await itinerariesService.list();
        setItineraries(list);
      } catch { /* ignore */ }
    })();
  }, []);
  
  const [branding, setBranding] = useState({
    agency_name: 'Voyanta', logo_url: '', address: '',
    contact_email: '', contact_phone: '', website: '',
    social_facebook: '', social_instagram: '', social_linkedin: '',
    cover_image_url: '', highlights: '',
    inclusions: '', exclusions: '', terms_of_payment: '',
    primary_color: '#0b1c30', template_style: params.get('theme') || 'classic', font_family: '',
  });

  const [costingPrefs, setCostingPrefs] = useState({
    fixed_markup: 0,
    pct_markup: 0,
    discount: 0,
    tax: 0
  });

  const [globalCustomBlocks, setGlobalCustomBlocks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { settingsService } = await import('../services/resourceService.js');
        const data = await settingsService.get();
        if (!data) return;
        setGlobalCustomBlocks(data.custom_blocks || []);
        
        setBranding((b) => ({
          ...b,
          agency_name: b.agency_name || data.agency_name || 'Voyanta',
          logo_url:    b.logo_url    || data.logo_url || '',
          address:     b.address     || data.address || '',
          contact_email: b.contact_email || data.contact_email || '',
          contact_phone: b.contact_phone || data.contact_phone || '',
          website:     b.website     || data.website || '',
          primary_color: b.primary_color || data.primary_color || '#0b1c30',
          font_family: b.font_family || data.font_family || '',
          social_facebook:  b.social_facebook  || data.social_facebook  || '',
          social_instagram: b.social_instagram || data.social_instagram || '',
          social_linkedin:  b.social_linkedin  || data.social_linkedin  || '',
        }));
      } catch { /* ignore */ }
    })();
  }, []);

  const reload = useCallback(async (pid) => {
    setLoading(true);
    try {
      if (pid) {
        const [p, its] = await Promise.all([fetchProposalById(pid), listItems(pid)]);
        if (p) {
          setProposal(p); setActiveId?.(p.id);
          setItems(its);
          const b = p.brief || {};
          setClient({
            customer_name: p.client_name || '',
            phone:    b.phone     || '',
            country:  b.country   || DEFAULT_COUNTRY,
            email:    b.email     || '',
            destination: p.destination || '',
            start_date:  p.start_date || '',
            end_date:    p.end_date   || '',
            date_mode:   b.date_mode || 'dates',
            duration_days: b.duration_days || 1,
            duration_nights: b.duration_nights || 1,
            arrival_city: p.arrival_city || '',
            arrival_airport: p.arrival_airport || '',
            departure_city: p.departure_city || '',
            departure_airport: p.departure_airport || '',
            num_adults:   b.num_adults   ?? p.travelers ?? 1,
            num_children: b.num_children ?? 0,
            budget: p.budget_max ?? '',
            special_notes: b.special_notes || '',
            itinerary_id: b.itinerary_id || '',
            tour_type: b.tour_type || '',
          });
          if (p.preferences?.branding) setBranding((s) => ({ ...s, ...p.preferences.branding }));
          if (p.preferences?.costing) setCostingPrefs((s) => ({ ...s, ...p.preferences.costing }));
        }
      } else { setProposal(null); setItems([]); }
    } catch (e) { toast.error(e.message || 'Failed to load proposal'); }
    finally { setLoading(false); }
  }, [setActiveId, toast]);

  useEffect(() => { reload(idParam); }, [idParam, reload]);

  const themeParam = params.get('theme');
  useEffect(() => {
    if (!client.tour_type) return;
    if (themeParam && !idParam) return; // Don't override if started from a template!
    const styleMap = {
      'Honeymoon': 'minimal',
      'Corporate': 'corporate',
      'Adventure': 'dark',
      'Luxury': 'modern',
      'Cruise': 'tropical',
      'Wellness': 'minimal',
      'Family': 'classic',
      'Friends': 'classic',
    };
    if (styleMap[client.tour_type]) {
      setBranding(b => ({ ...b, template_style: styleMap[client.tour_type] }));
    }
  }, [client.tour_type, idParam, themeParam]);

  const [mountNode, setMountNode] = useState(null);

  // Mutate dashboard chrome — heavy DOM setup runs once on mount
  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;
    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'New Proposal' || t === 'Proposals')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });
    const p  = canvas.querySelector('h2')?.parentElement?.querySelector('p'); if (p) p.textContent = 'Guided proposal builder.';
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.style.display = 'inline-flex';
      cta.innerHTML = '<span class="material-symbols-outlined">close</span> Exit';
      cta.onclick = () => navigate('/proposals');
    }
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#wizard-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'wizard-mount';
      canvas.appendChild(mount);
    }
    setMountNode(mount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h2 = document.querySelector('main .max-w-7xl h2');
    if (h2) h2.textContent = proposal ? proposal.name : 'New Proposal';
  }, [proposal?.name]);

  useEffect(() => {
    const card = document.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    card.style.cursor = 'pointer';
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const buildPayload = useCallback(() => {
    const c = client;
    const travelers = (parseInt(c.num_adults, 10) || 0) + (parseInt(c.num_children, 10) || 0);
    return {
      name: c.destination ? `${c.destination} — ${c.customer_name || 'Trip'}` : (c.customer_name || 'Untitled Proposal'),
      client_name: c.customer_name || 'New Client',
      destination: c.destination || null,
      start_date: c.date_mode === 'dates' ? (c.start_date || null) : null,
      end_date: c.date_mode === 'dates' ? (c.end_date || null) : null,
      arrival_city: c.arrival_city || null,
      arrival_airport: c.arrival_airport || null,
      departure_city: c.departure_city || null,
      departure_airport: c.departure_airport || null,
      travelers: travelers || 1,
      budget_max: c.budget === '' ? null : Number(c.budget),
      currency: 'INR',
      brief: {
        phone: c.phone, country: c.country, email: c.email,
        date_mode: c.date_mode,
        duration_days: parseInt(c.duration_days, 10) || 1,
        duration_nights: parseInt(c.duration_nights, 10) || 1,
        num_adults: parseInt(c.num_adults, 10) || 0,
        num_children: parseInt(c.num_children, 10) || 0,
        special_notes: c.special_notes,
        itinerary_id: c.itinerary_id || null,
        tour_type: c.tour_type || null,
      },
      preferences: { ...(proposal?.preferences || {}), branding, costing: costingPrefs },
      itinerary: proposal?.itinerary,
      status: proposal?.status || 'Draft',
    };
  }, [client, branding, costingPrefs, proposal]);

  const onApplyItinerary = useCallback(async (itinId) => {
    if (!itinId) return;
    const selectedItin = itineraries.find((it) => it.id === itinId);
    if (!selectedItin) return;
    if (!confirm('Applying this schedule will overwrite the current proposal itinerary days. Continue?')) return;
    if (!proposal?.id) {
      toast.error('Save the client info first');
      return;
    }
    try {
      const blocks = await import('../services/resourceService.js').then(m => m.itineraryBlocksService.list({ itinerary_id: itinId }));
      blocks.sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
      
      const mappedDays = blocks.map((b) => ({
        day: b.day_number || 1,
        title: b.title || '',
        description: b.content || '',
        image_url: b.image_url || null,
        notes: b.notes || '',
        block_type: b.block_type || 'day'
      }));

      const updated = await updateProposal(proposal.id, {
        itinerary: { days: mappedDays },
        destination: proposal.destination || selectedItin.destination || null,
      });
      setProposal(updated);
      setClient((s) => ({ ...s, itinerary_id: itinId, destination: updated.destination }));
      
      try {
        const { data: pastProps } = await supabase.from('proposals').select('id').eq('brief->>itinerary_id', itinId);
        if (pastProps && pastProps.length > 0) {
          const pastIds = pastProps.map(p => p.id);
          const { data: pastItems } = await supabase.from('proposal_items').select('ref_id, kind, label, unit_price, currency, meta').in('proposal_id', pastIds);
          
          if (pastItems && pastItems.length > 0) {
            const freq = {};
            const details = {};
            pastItems.forEach(pi => {
              if (!pi.ref_id) return;
              const key = `${pi.kind}:${pi.ref_id}`;
              freq[key] = (freq[key] || 0) + 1;
              if (!details[key]) details[key] = pi;
            });
            
            const toAdd = Object.keys(freq).filter(k => freq[k] >= 5).map(k => details[k]);
            if (toAdd.length > 0) {
              const currentItems = await listItems(proposal.id);
              const currentRefIds = new Set(currentItems.map(c => c.ref_id).filter(Boolean));
              
              let addedCount = 0;
              for (const item of toAdd) {
                if (!currentRefIds.has(item.ref_id)) {
                  await addItem(proposal.id, {
                    kind: item.kind, ref_id: item.ref_id, label: item.label,
                    qty: 1, unit_price: item.unit_price, currency: item.currency, meta: item.meta
                  });
                  addedCount++;
                }
              }
              if (addedCount > 0) {
                toast.success(`Itinerary applied, and ${addedCount} frequently used items were auto-linked.`);
                listItems(proposal.id).then(setItems);
                return;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Intelligence auto-link failed:', err);
      }
      toast.success('Itinerary applied');
    } catch (e) {
      toast.error(e.message || 'Failed to apply itinerary');
    }
  }, [itineraries, proposal, toast]);

  const saveDraft = useCallback(async (silent = false) => {
    if (stepParam === 1 && step1Ref.current) {
      const isValid = await step1Ref.current.validate();
      if (!isValid) {
        if (!silent) toast.error('Please fix the errors in the form before saving.');
        throw new Error('Validation failed');
      }
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let p;
      if (proposal?.id) p = await updateProposal(proposal.id, payload);
      else { p = await createProposal(payload); setActiveId?.(p.id); setParams({ id: p.id, step: String(stepParam) }, { replace: true }); }
      setProposal((prev) => ({ ...(prev || {}), ...p }));
      if (!silent) toast.success('Draft saved');
      return p;
    } catch (e) { if (!silent) toast.error(e.message || 'Save failed'); throw e; }
    finally { setSaving(false); }
  }, [buildPayload, proposal, setActiveId, setParams, stepParam, toast]);

  const goStep = (n, idOverride) => setParams({ id: idOverride ?? proposal?.id ?? '', step: String(n) }, { replace: false });

  const onNext = async () => {
    let pid = proposal?.id;
    if (stepParam === 1 || stepParam === 3 || stepParam === 4) {
      try { const p = await saveDraft(true); pid = p?.id || pid; }
      catch { return; }
    }
    if (!pid && stepParam !== 1) { toast.error('Save the client info first'); return; }
    goStep(Math.min(5, stepParam + 1), pid);
  };
  const onPrev = () => goStep(Math.max(1, stepParam - 1));

  const sanitizeCurrency = (v) => /^[A-Z]{3}$/.test(String(v || '').toUpperCase()) ? String(v).toUpperCase() : (proposal?.currency || 'INR');
  const nights = useMemo(() => {
    const a = proposal?.start_date || client.start_date;
    const b = proposal?.end_date   || client.end_date;
    if (!a || !b) return 1;
    if (client.date_mode === 'days') return parseInt(client.duration_nights, 10) || 1;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    const n = Math.round(ms / (1000 * 60 * 60 * 24));
    return n > 0 ? n : 1;
  }, [proposal?.start_date, proposal?.end_date, client.start_date, client.end_date, client.date_mode, client.duration_nights]);
  const travelers = useMemo(() => {
    const t = (parseInt(client.num_adults, 10) || 0) + (parseInt(client.num_children, 10) || 0);
    return t > 0 ? t : (proposal?.travelers || 1);
  }, [client.num_adults, client.num_children, proposal?.travelers]);

  const defaultQtyFor = (kind) => kind === 'hotel' ? nights : (kind === 'flight' || kind === 'activity' ? travelers : 1);

  const addItemsToProposal = async (kind, rows, toLabel, toUnit) => {
    if (!proposal?.id) { toast.error('Save the client info first'); return; }
    try {
      const qty = defaultQtyFor(kind);
      await Promise.all(rows.map((r) =>
        addItem(proposal.id, {
          kind, ref_id: r.id, label: toLabel(r),
          qty, unit_price: toUnit(r),
          currency: sanitizeCurrency(r.currency),
          meta: { source: kind + 's', auto_qty_basis: kind === 'hotel' ? 'nights' : (kind === 'flight' || kind === 'activity' ? 'travelers' : 'one') },
        })
      ));
      const its = await listItems(proposal.id); setItems(its);
      toast.success(`Added ${rows.length} ${kind}(s) · qty ${qty}`);
    } catch (e) { toast.error(e.message); }
  };

  const onRemoveItem = async (id) => {
    try { await removeItem(id); setItems((s) => s.filter((x) => x.id !== id)); toast.success('Removed'); }
    catch (e) { toast.error(e.message); }
  };

  const onPatchItem = async (id, patch) => {
    try { const u = await updateItem(id, patch); setItems((s) => s.map((x) => x.id === id ? u : x)); }
    catch (e) { toast.error(e.message); }
  };
  
  const handleOpenImport = (resource) => {
    setImportResource(resource);
    setImportOpen(true);
  };
  
  const handleImportSuccess = () => {
    reload(proposal?.id); // Quick refresh after import
  };

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="space-y-lg" data-testid="proposal-wizard">
          <ProgressBar step={stepParam} onJump={(n) => proposal?.id ? goStep(n, proposal.id) : (n === 1 ? null : toast.error('Save client info first'))} />

          {loading ? (
            <div className="glass-card p-xl rounded-xl text-center">Loading…</div>
          ) : (
            <>
              {stepParam === 1 && <Step1Client ref={step1Ref} client={client} setClient={setClient} />}
              {stepParam === 2 && <Step2Itinerary proposal={proposal} setProposal={setProposal} reload={reload} itineraries={itineraries} onApplyItinerary={onApplyItinerary} client={client} items={items} setItems={setItems} proposalCurrency={proposal?.currency || 'INR'} />}
              {stepParam === 3 && <Step5Costing proposalId={proposal?.id} items={items} setItems={setItems}
                onPatchItem={onPatchItem} onRemoveItem={onRemoveItem}
                proposalCurrency={proposal?.currency || 'INR'} costingPrefs={costingPrefs} setCostingPrefs={setCostingPrefs} />}
              {stepParam === 4 && <Step6Branding branding={branding} setBranding={setBranding} customBlocks={globalCustomBlocks} />}
              {stepParam === 5 && <Step7Preview proposalId={proposal?.id} proposalName={proposal?.name} branding={branding} customBlocks={globalCustomBlocks} />}
            </>
          )}

          <div className="sticky bottom-4 mt-xl w-full max-w-5xl mx-auto z-50 p-4 rounded-2xl flex items-center gap-md shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/40 bg-white/60 backdrop-blur-xl transition-all duration-300" data-testid="wizard-footer">
            <button onClick={onPrev} disabled={stepParam === 1} data-testid="wizard-prev"
              className="px-xl py-3 border border-white/60 bg-white/40 backdrop-blur-md rounded-xl font-label-md text-on-surface hover:bg-white/80 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white/40">
              Previous
            </button>
            <button onClick={() => saveDraft(false)} disabled={saving} data-testid="wizard-save"
              className="px-xl py-3 border border-white/60 bg-white/40 backdrop-blur-md rounded-xl font-label-md text-on-surface hover:bg-white/80 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white/40">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <span className="flex-1" />
            <span className="font-label-md text-on-surface-variant uppercase tracking-widest mr-md bg-white/50 px-lg py-2 rounded-full border border-white/40 shadow-inner backdrop-blur-sm">
              Step {stepParam} <span className="opacity-50">/ 5</span>
            </span>
            {stepParam < 5 && (
              <button onClick={onNext} disabled={saving} data-testid="wizard-next"
                className="px-xl py-3 bg-primary/90 backdrop-blur-md text-white rounded-xl font-label-md hover:bg-primary transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md flex items-center gap-sm">
                Continue to {STEPS[stepParam]?.label || 'Next'}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>
          
          {importOpen && <ImportModal resource={importResource} onClose={() => setImportOpen(false)} onImported={handleImportSuccess} />}
        </div>,
        mountNode
      )}
    </div>
  );
}
