import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import ImportModal from '../components/ImportModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalStore } from '../store/proposalStore.js';
import { itinerariesService } from '../services/resourceService.js';
import { supabase } from '../lib/supabaseClient.js';
import { TEMPLATE_LIST } from '../templates/registry.js';

const cleanPrice = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

import { ProgressBar, STEPS } from './wizard/ProgressBar.jsx';
import { Step1Client } from './wizard/Step1Client.jsx';
import { Step2Itinerary } from './wizard/Step2Itinerary.jsx';
import { Step5Costing } from './wizard/Step5Costing.jsx';
import { lazy, Suspense } from 'react';

// Lazy load the heavier wizard steps
const Step6Branding = lazy(() => import('./wizard/Step6Branding.jsx').then(m => ({ default: m.default || m.Step6Branding })));
const Step7Preview = lazy(() => import('./wizard/Step7Preview.jsx').then(m => ({ default: m.default || m.Step7Preview })));

export default function ProposalWizard() {
  const wrapperRef = useRef(null);
  const step1Ref = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { signOut, isDemo, user } = useAuth();

  const idParam   = params.get('id') || '';
  const stepParam = Math.max(1, Math.min(5, parseInt(params.get('step') || '1', 10) || 1));

  // Zustand Store
  const { 
    activeId, proposal, items, client, branding, costingPrefs, status,
    setClient, setBranding, setCostingPrefs, setProposal, setItems,
    loadProposal, saveDraftBackground, addItemsOptimistic, 
    removeItemOptimistic, updateItemOptimistic
  } = useProposalStore();

  const [itineraries, setItineraries] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importResource, setImportResource] = useState('');
  const [globalCustomBlocks, setGlobalCustomBlocks] = useState([]);

  // Fetch initial data like settings and itineraries
  useEffect(() => {
    (async () => {
      try {
        const list = await itinerariesService.list();
        setItineraries(list);
        
        const { settingsService } = await import('../services/resourceService.js');
        const data = await settingsService.get();
        if (data) {
          setGlobalCustomBlocks(data.custom_blocks || []);
          // Only update branding if we aren't loading a saved proposal with its own branding
          if (!activeId && !idParam) {
            setBranding((b) => ({
              ...b,
              agency_name: data.agency_name || '',
              logo_url:    data.logo_url || '',
              address:     data.address || '',
              contact_email: data.contact_email || '',
              contact_phone: data.contact_phone || '',
              website:     data.website || '',
              primary_color: data.primary_color || '#0b1c30',
              font_family: data.font_family || '',
              social_facebook:  data.social_facebook  || '',
              social_instagram: data.social_instagram || '',
              social_linkedin:  data.social_linkedin  || '',
            }));
          }
        }
      } catch { /* ignore */ }
    })();
  }, [setBranding, activeId, idParam]);

  // Load proposal from DB on mount / URL change
  // Load proposal from DB on mount / URL change
  useEffect(() => {
    if (idParam && idParam !== activeId) {
      loadProposal(idParam).catch(e => toast.error(e.message || 'Failed to load proposal'));
    } else if (!idParam && activeId && !proposal?.id) {
      // Clear if we navigate to /proposals/wizard without an ID but have one active from an old session
      loadProposal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  const themeParam = params.get('theme');
  useEffect(() => {
    if (themeParam && !idParam) return; // Don't override if started from a template!
    
    let style = 'classic';
    const tourType = (client.tour_type || '').toLowerCase();
    const dest = (client.destination || proposal?.destination || '').toLowerCase();
    
    if (tourType.includes('honeymoon')) style = 'honeymoon';
    else if (tourType.includes('family')) style = 'family';
    else if (tourType.includes('corporate')) style = 'corporate';
    else if (tourType.includes('adventure')) style = 'adventure';
    else if (tourType.includes('beach') || tourType.includes('tropical')) style = 'beach';
    else if (tourType.includes('cruise')) style = 'cruise';
    else if (tourType.includes('wildlife') || tourType.includes('safari')) style = 'wildlife';
    else if (tourType.includes('luxury')) style = 'modern';
    else {
      // Infer from destination if no matching tour type
      if (dest.includes('maldives') || dest.includes('bali') || dest.includes('beach') || dest.includes('goa')) style = 'beach';
      else if (dest.includes('alps') || dest.includes('swiss') || dest.includes('himalayas') || dest.includes('mountain')) style = 'adventure';
      else if (dest.includes('africa') || dest.includes('safari') || dest.includes('kenya')) style = 'wildlife';
      else if (dest.includes('dubai') || dest.includes('paris') || dest.includes('london')) style = 'modern';
    }

    setBranding(b => ({ ...b, template_style: style }));
  }, [client.tour_type, client.destination, proposal?.destination, idParam, themeParam, setBranding]);

  useEffect(() => {
    if (themeParam && !idParam) {
      setBranding(b => {
        const tpl = TEMPLATE_LIST.find(t => t.slug === themeParam || t.id === themeParam || t.theme === themeParam);
        return {
          ...b,
          template_style: themeParam,
          cover_image_url: b.cover_image_url || (tpl ? tpl.thumbnail : '')
        };
      });
    }
  }, [themeParam, idParam, setBranding]);

  // Eagerly preload heavy steps so they are instantly ready when the user reaches them
  useEffect(() => {
    import('./wizard/Step6Branding.jsx');
    import('./wizard/Step7Preview.jsx');
  }, []);

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

  const [pendingItinerary, setPendingItinerary] = useState(null);

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

  const defaultQtyFor = useCallback((kind) => kind === 'hotel' ? nights : (kind === 'flight' || kind === 'activity' ? travelers : 1), [nights, travelers]);

  const flattenBlocksToText = (content) => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content.map(block => {
      if (!block || !block.data) return '';
      const { type, data } = block;
      if (type === 'heading') return `## ${data.text || ''}`;
      if (type === 'text') return data.text || '';
      if (type === 'hotel') return `🏨 Hotel: ${data.name || ''}\n${data.details || ''}`;
      if (type === 'flight') return `✈️ Flight: ${data.name || ''}\n${data.details || ''}`;
      if (type === 'transfer') return `🚗 Transfer: ${data.name || ''}\n${data.details || ''}`;
      if (type === 'activity') return `🎫 Activity: ${data.name || ''}\n${data.details || ''}`;
      if (type === 'meals') return `🍽️ Meals: ${data.name || ''}\n${data.details || ''}`;
      return '';
    }).filter(text => text.trim()).join('\n\n');
  };

  const extractImageFromBlocks = (content) => {
    if (!Array.isArray(content)) return null;
    const imgBlock = content.find(b => b.type === 'image' || b.type === 'gallery');
    if (!imgBlock || !imgBlock.data) return null;
    if (imgBlock.data.url) return imgBlock.data.url;
    if (Array.isArray(imgBlock.data.urls) && imgBlock.data.urls.length > 0) return imgBlock.data.urls[0];
    if (Array.isArray(imgBlock.data.images) && imgBlock.data.images.length > 0) return imgBlock.data.images[0];
    return null;
  };

  const onApplyItinerary = useCallback(async (strategy, itinOverride) => {
    const targetItin = itinOverride || pendingItinerary;
    if (!targetItin) return;

    try {
      const blocks = await import('../services/resourceService.js').then(m => m.itineraryBlocksService.list({ itinerary_id: targetItin.id }));
      blocks.sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
      
      const mappedDays = blocks.map((b) => {
        const rawContent = typeof b.content === 'string' ? JSON.parse(b.content) : (b.content || []);
        const cleanContent = Array.isArray(rawContent) ? rawContent.map(item => ({ ...item, id: item.id || crypto.randomUUID() })) : [];
        return {
          id: crypto.randomUUID(),
          day: b.day_number || 1,
          title: b.title || '',
          description: b.description || flattenBlocksToText(rawContent) || '',
          image_url: b.image_url || extractImageFromBlocks(rawContent) || null,
          notes: b.notes || '',
          block_type: b.block_type || 'day',
          content: cleanContent
        };
      });

      setProposal((p) => {
        const currentDays = [...(p?.itinerary?.days || [])];
        let nextDays = [];

        if (strategy === 'replace') {
          nextDays = mappedDays;
        } else if (strategy === 'append') {
          nextDays = [...currentDays];
          const startDay = nextDays.length;
          mappedDays.forEach((md, i) => {
            nextDays.push({ ...md, day: startDay + i + 1 });
          });
        } else if (strategy === 'merge') {
          nextDays = [...currentDays];
          mappedDays.forEach((md, i) => {
            if (i < nextDays.length) {
              nextDays[i] = { ...nextDays[i], title: md.title, description: md.description, image_url: md.image_url, block_type: md.block_type, content: md.content };
            } else {
              nextDays.push({ ...md, day: i + 1 });
            }
          });
        }

        return { ...p, itinerary: { days: nextDays }, destination: p?.destination || targetItin.destination || null };
      });

      setClient((c) => ({ ...c, itinerary_id: targetItin.id, destination: proposal?.destination || targetItin.destination || null }));
      
      // Harvest inventory items (Hotels, Flights, Activities, Transfers, Meals, Custom) from the imported rich content blocks
      const currentRefIds = new Set(items.map(it => String(it.ref_id || '')).filter(Boolean));
      const currentLabels = new Set(items.map(it => String(it.label || '').toLowerCase().trim()).filter(Boolean));
      const harvestedItems = [];
      
      mappedDays.forEach((dayObj, idx) => {
        const dayNum = dayObj.day || idx + 1;
        if (Array.isArray(dayObj.content)) {
          dayObj.content.forEach((block) => {
            if (!block || !block.type || !block.data) return;
            const k = block.type.toLowerCase();
            if (['hotel', 'flight', 'activity', 'transfer', 'meals', 'custom'].includes(k)) {
              const raw = block.data.rawItem || {};
              const refId = String(raw.id || block.data.id || block.id || '');
              const label = String(block.data.name || raw.name || `${raw.airline || 'Flight'} ${raw.flight_no || ''}`.trim() || `${k.toUpperCase()} Item`).trim();
              const lowerLabel = label.toLowerCase();
              
              if ((!refId || !currentRefIds.has(refId)) && (!lowerLabel || !currentLabels.has(lowerLabel))) {
                if (refId) currentRefIds.add(refId);
                if (lowerLabel) currentLabels.add(lowerLabel);
                const price = cleanPrice(
                  raw.price_per_night ?? raw.price ?? raw.cost ?? raw.rate ?? raw.unit_price ?? raw.amount ??
                  block.data.price ?? block.data.price_per_night ?? block.data.rate ?? block.data.cost ?? block.data.unit_price ?? block.data.amount ??
                  0
                );
                harvestedItems.push({
                  kind: k,
                  ref_id: refId || crypto.randomUUID(),
                  label: label,
                  qty: defaultQtyFor(k),
                  unit_price: price,
                  currency: sanitizeCurrency(raw.currency || proposal?.currency),
                  meta: { source: `${k}s`, day: dayNum, details: block.data.details || '' }
                });
              }
            }
          });
        }
      });

      if (harvestedItems.length > 0) {
        await addItemsOptimistic(harvestedItems);
      }

      // Fire background sync
      saveDraftBackground().catch(e => toast.error('Failed to sync itinerary to database: ' + e.message));
      toast.success('Itinerary applied');

      // AI auto-link intelligence (async)
      (async () => {
        try {
          const { data: pastProps } = await supabase.from('proposals').select('id').eq('brief->>itinerary_id', targetItin.id);
          if (pastProps && pastProps.length > 0) {
            const pastIds = pastProps.map(p => p.id);
            const { data: pastItems } = await supabase.from('proposal_items').select('ref_id, kind, label, unit_price, currency, meta').in('proposal_id', pastIds);
            
            if (pastItems && pastItems.length > 0) {
              const freq = {}; const details = {};
              pastItems.forEach(pi => {
                if (!pi.ref_id) return;
                const key = `${pi.kind}:${pi.ref_id}`;
                freq[key] = (freq[key] || 0) + 1;
                if (!details[key]) details[key] = pi;
              });
              
              const toAdd = Object.keys(freq).filter(k => freq[k] >= 5).map(k => details[k]);
              if (toAdd.length > 0) {
                const currentRefIds = new Set(items.map(c => c.ref_id).filter(Boolean));
                const itemsToInsert = [];
                for (const item of toAdd) {
                  if (!currentRefIds.has(item.ref_id)) {
                    // For merged items, append them to day 1 for now (intelligence can be refined later)
                    let targetDay = item.meta?.day || 1;
                    if (strategy === 'append') targetDay += (proposal?.itinerary?.days?.length || 0);

                    itemsToInsert.push({
                      kind: item.kind, ref_id: item.ref_id, label: item.label,
                      qty: 1, unit_price: item.unit_price, currency: sanitizeCurrency(item.currency), meta: { ...item.meta, day: targetDay }
                    });
                  }
                }
                if (itemsToInsert.length > 0) {
                  await addItemsOptimistic(itemsToInsert);
                  toast.success(`Auto-linked ${itemsToInsert.length} frequently used items.`);
                }
              }
            }
          }
        } catch (err) { console.warn('Intelligence auto-link failed:', err); }
      })();
    } catch (e) {
      toast.error(e.message || 'Failed to apply itinerary');
    }
  }, [pendingItinerary, proposal, toast, setProposal, setClient, saveDraftBackground, addItemsOptimistic, items, defaultQtyFor]);

  const triggerApplyItinerary = useCallback(async (itinId) => {
    if (!itinId) {
      if (window.confirm('Start from scratch? This will clear all current itinerary days and items.')) {
        setProposal(p => ({ ...p, itinerary: { days: [] } }));
        if (items && items.length > 0) {
          items.forEach(it => removeItemOptimistic(it.id).catch(() => {}));
        }
        setItems([]);
        setClient(c => ({ ...c, itinerary_id: '' }));
        toast.success('Itinerary cleared. You can start from scratch.');
      }
      return;
    }
    const selectedItin = itineraries.find((it) => it.id === itinId);
    if (!selectedItin) return;
    
    let pid = proposal?.id;
    if (!pid) {
      try {
        const p = await saveDraftBackground();
        pid = p?.id;
      } catch {
        toast.error('Save the client info first');
        return;
      }
    }
    setPendingItinerary(selectedItin);
    setTimeout(() => {
      onApplyItinerary('replace', selectedItin);
    }, 0);
  }, [itineraries, proposal?.id, saveDraftBackground, toast, onApplyItinerary, setProposal, setItems, setClient, items, removeItemOptimistic]);

  const saveDraft = useCallback(async (silent = false) => {
    if (stepParam === 1 && step1Ref.current) {
      const isValid = await step1Ref.current.validate();
      if (!isValid) {
        if (!silent) toast.error('Please fix the errors in the form before saving.');
        throw new Error('Validation failed');
      }
    }

    try {
      // Fire and forget (it sets the status to 'saving' internally)
      const p = await saveDraftBackground();
      if (!silent) toast.success('Draft saved');
      if (p.id && p.id !== idParam) {
        setParams({ id: p.id, step: String(stepParam) }, { replace: true });
      }
      return p;
    } catch (e) { 
      if (!silent) toast.error(e.message || 'Save failed'); 
      throw e; 
    }
  }, [saveDraftBackground, setParams, stepParam, toast, idParam]);

  // Automatic background saving (auto-save debounced)
  // Automatic background saving (auto-save debounced)
  useEffect(() => {
    if (!client?.customer_name && !client?.destination) return;
    const timer = setTimeout(async () => {
      try {
        const p = await saveDraftBackground();
        if (p?.id && !idParam) {
          setParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('id', p.id);
            return next;
          }, { replace: true });
        }
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [client, branding, costingPrefs, items, saveDraftBackground, idParam, setParams]);

  const goStep = (n, idOverride) => setParams({ id: idOverride || proposal?.id || activeId || idParam || '', step: String(n) }, { replace: false });

  const handleJump = async (n) => {
    let pid = proposal?.id;
    if (!pid) {
      try {
        const p = await saveDraftBackground();
        pid = p?.id;
        if (pid && pid !== idParam) {
          setParams({ id: pid, step: String(n) }, { replace: false });
          return;
        }
      } catch { /* ignore */ }
    } else {
      saveDraftBackground().catch(() => {});
    }
    goStep(n, pid);
  };

  const onNext = async () => {
    let pid = proposal?.id;
    if (stepParam === 1 && step1Ref.current) {
      const isValid = await step1Ref.current.validate();
      if (!isValid) {
        toast.error('Please fill in the client name and required fields.');
        return;
      }
    }
    if (!pid) {
      try {
        const p = await saveDraftBackground();
        pid = p?.id;
      } catch (err) {
        console.warn('saveDraftBackground error in onNext:', err);
      }
    } else {
      saveDraftBackground().catch(() => {});
    }
    goStep(Math.min(5, stepParam + 1), pid || proposal?.id || activeId || idParam);
  };

  const onPrev = async () => {
    let pid = proposal?.id;
    if (!pid) {
      try {
        const p = await saveDraftBackground();
        pid = p?.id;
      } catch { /* ignore */ }
    } else {
      saveDraftBackground().catch(() => {});
    }
    goStep(Math.max(1, stepParam - 1), pid);
  };

  const handleAddItems = async (kind, rows, toLabel, toUnit) => {
    let pid = proposal?.id;
    if (!pid) {
      try {
        const p = await saveDraftBackground();
        pid = p?.id;
      } catch {
        toast.error('Could not auto-save draft');
        return;
      }
    }
    try {
      const qty = defaultQtyFor(kind);
      const newItems = rows.map((r) => ({
        kind, ref_id: r.id, label: toLabel(r),
        qty, unit_price: toUnit(r),
        currency: sanitizeCurrency(r.currency),
        meta: { source: kind + 's', auto_qty_basis: kind === 'hotel' ? 'nights' : (kind === 'flight' || kind === 'activity' ? 'travelers' : 'one') },
      }));
      
      await addItemsOptimistic(newItems);
      toast.success(`Added ${rows.length} ${kind}(s) · qty ${qty}`);
    } catch (e) { toast.error(e.message); }
  };

  const onRemoveItem = async (id) => {
    try { await removeItemOptimistic(id); toast.success('Removed'); }
    catch (e) { toast.error(e.message); }
  };

  const onPatchItem = async (id, patch) => {
    try { await updateItemOptimistic(id, patch); }
    catch (e) { toast.error(e.message); }
  };
  
  const handleOpenImport = (resource) => {
    setImportResource(resource);
    setImportOpen(true);
  };
  
  const handleImportSuccess = () => {
    loadProposal(proposal?.id);
  };

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="space-y-lg pb-36" data-testid="proposal-wizard">
          <ProgressBar step={stepParam} onJump={handleJump} />

          {status === 'loading' && !proposal ? (
            <div className="glass-card p-xl rounded-xl text-center">Loading Proposal…</div>
          ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepParam}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <Suspense fallback={<div className="p-xl text-center"><span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span></div>}>
                    {stepParam === 1 && <Step1Client ref={step1Ref} client={client} setClient={setClient} />}
                    {stepParam === 2 && <Step2Itinerary proposal={proposal} setProposal={setProposal} reload={() => loadProposal(proposal?.id)} itineraries={itineraries} onApplyItinerary={triggerApplyItinerary} client={client} items={items} setItems={setItems} proposalCurrency={proposal?.currency || 'INR'} addItemsOptimistic={addItemsOptimistic} saveDraft={saveDraft} />}
                    {stepParam === 3 && <Step5Costing proposal={proposal} setProposal={setProposal} proposalId={proposal?.id} items={items} setItems={setItems}
                      onPatchItem={onPatchItem} onRemoveItem={onRemoveItem} addItemsOptimistic={addItemsOptimistic} saveDraft={saveDraft}
                      proposalCurrency={proposal?.currency || 'INR'} costingPrefs={costingPrefs} setCostingPrefs={setCostingPrefs} />}
                    {stepParam === 4 && <Step6Branding branding={branding} setBranding={setBranding} customBlocks={globalCustomBlocks} proposal={proposal} client={client} />}
                    {stepParam === 5 && <Step7Preview proposalId={proposal?.id} proposalName={proposal?.name} branding={branding} customBlocks={globalCustomBlocks} onAddCustomBlock={(cb) => {
                      setGlobalCustomBlocks(s => {
                        const next = [...s, cb];
                        try { localStorage.setItem('voyanta_global_custom_blocks', JSON.stringify(next)); } catch {}
                        import('../services/resourceService.js').then(({ settingsService }) => {
                          settingsService.get().then(old => {
                            settingsService.save({ ...old, custom_blocks: next }).catch(() => {});
                          });
                        });
                        return next;
                      });
                    }} />}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="fixed bottom-0 right-0 w-[calc(100%-16rem)] z-50 p-4 flex justify-center pb-0" data-testid="wizard-footer-wrapper">
            <div className="w-full max-w-5xl flex items-center gap-md shadow-[0_-8px_32px_rgba(0,0,0,0.1)] border border-b-0 border-outline-variant/40 bg-surface-container-lowest/90 backdrop-blur-2xl transition-all duration-300 rounded-t-3xl p-4">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onPrev} disabled={stepParam === 1} data-testid="wizard-prev"
              className="px-xl py-3 border border-white/60 bg-white/40 backdrop-blur-md rounded-xl font-label-md text-on-surface hover:bg-white/80 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white/40 disabled:pointer-events-none">
              Previous
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { if (stepParam === 5) { window.dispatchEvent(new CustomEvent('voyanta:step7-save-clicked')); } saveDraft(false); }} disabled={status === 'saving'} data-testid="wizard-save"
              className="px-xl py-3 border border-white/60 bg-white/40 backdrop-blur-md rounded-xl font-label-md text-on-surface hover:bg-white/80 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white/40 disabled:pointer-events-none flex gap-2 items-center">
              {status === 'saving' ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : null}
              {status === 'saving' ? 'Saving…' : 'Save Draft'}
            </motion.button>
            <span className="flex-1" />
            <span className="font-label-md text-on-surface-variant uppercase tracking-widest mr-md bg-white/50 px-lg py-2 rounded-full border border-white/40 shadow-inner backdrop-blur-sm">
              Step {stepParam} <span className="opacity-50">/ 5</span>
            </span>
            {stepParam < 5 && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onNext} disabled={status === 'saving' && !proposal?.id} data-testid="wizard-next"
                className="px-xl py-3 bg-primary/90 backdrop-blur-md text-white rounded-xl font-label-md hover:bg-primary transition-all shadow-md flex items-center gap-sm disabled:opacity-60 disabled:pointer-events-none">
                Continue to {STEPS[stepParam]?.label || 'Next'}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </motion.button>
            )}
            </div>
          </motion.div>
          
          {importOpen && <ImportModal resource={importResource} onClose={() => setImportOpen(false)} onImported={handleImportSuccess} />}
        </div>,
        mountNode
      )}
    </div>
  );
}
