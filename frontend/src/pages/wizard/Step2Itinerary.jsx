import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { DayBlock } from '../../components/timeline/DayBlock.jsx';
import { hotelsService, flightsService, activitiesService } from '../../services/resourceService.js';
import { addItem, removeItem } from '../../services/proposalItemService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useProposalStore } from '../../store/proposalStore.js';
import { logActivity } from '../../services/activityLogService.js';
import { buildVIItinerary, getClimateClassification } from '../../lib/viClimateIntelligence.js';

const cleanPrice = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};
const extractPrice = (item) => cleanPrice(item?.price_per_night ?? item?.price ?? item?.cost ?? item?.rate ?? item?.unit_price ?? item?.amount ?? 0);

export function Step2Itinerary({ proposal, setProposal, itineraries, onApplyItinerary, client, items, setItems, proposalCurrency, addItemsOptimistic, saveDraft }) {
  const toast = useToast();
  const { saveDraftBackground } = useProposalStore();
  const days = proposal?.itinerary?.days || [];

  const [activeTab, setActiveTab] = useState('sub_destinations');
  const [libraryData, setLibraryData] = useState({ hotels: [], flights: [], itinerary: [] });
  const [search, setSearch] = useState('');

  const [vaultItems, setVaultItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [relatedSuggestions, setRelatedSuggestions] = useState([]);
  const [subDestinations, setSubDestinations] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const shownRef = useRef(new Set());
  const addedRef = useRef(new Set());

  // Load ranked suggestions from vault for this proposal
  useEffect(() => {
    if (!proposal?.id) return;

    let isMounted = true;
    setSuggestionsLoading(true);

    (async () => {
      try {
        let token = null;
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
          if (session?.access_token) token = session.access_token;
        } catch { }

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Fetch suggestions for both hotels and activities
        const [resHotels, resActivities] = await Promise.all([
          fetch(`/api/proposals/${proposal.id}/suggestions?step=hotels`, { headers }),
          fetch(`/api/proposals/${proposal.id}/suggestions?step=activities`, { headers })
        ]);

        let hotels = [];
        let activities = [];
        let relHotels = [];
        let relActivities = [];

        let tempSubDestinations = [];
        if (resHotels.ok) {
          const data = await resHotels.json();
          hotels = data.suggestions || [];
          relHotels = data.related_suggestions || [];
          if (data.sub_destinations) {
            tempSubDestinations = data.sub_destinations;
          }
        }
        if (resActivities.ok) {
          const data = await resActivities.json();
          activities = data.suggestions || [];
          relActivities = data.related_suggestions || [];
          if (data.sub_destinations && tempSubDestinations.length === 0) {
            tempSubDestinations = data.sub_destinations;
          }
        }

        if (isMounted) {
          const merged = [...hotels, ...activities];
          setSuggestions(merged);
          setSubDestinations(tempSubDestinations);

          // Merge related suggestions and de-duplicate by ID
          const mergedRelated = [...relHotels, ...relActivities];
          const uniqueRelatedMap = {};
          mergedRelated.forEach(item => {
            uniqueRelatedMap[item.id] = item;
          });
          setRelatedSuggestions(Object.values(uniqueRelatedMap));

          // Log suggestion_shown for any newly shown suggestions
          merged.forEach(sug => {
            if (!shownRef.current.has(sug.id)) {
              shownRef.current.add(sug.id);
              logActivity('suggestion_shown', `Suggestion shown: ${sug.name}`, 'Agency Team', 'knowledge_object', sug.id);
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        if (isMounted) setSuggestionsLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [proposal?.id, items?.length]);

  // Log suggestion_rejected when the builder step unmounts (closes/finishes)
  useEffect(() => {
    return () => {
      const shown = shownRef.current;
      const added = addedRef.current;
      shown.forEach(id => {
        if (!added.has(id)) {
          logActivity('suggestion_rejected', `Suggestion shown but not added`, 'Agency Team', 'knowledge_object', id);
        }
      });
    };
  }, []);

  const handleDismissRelation = async (sug) => {
    if (!sug.relation) return;

    // Optimistically update UI
    setRelatedSuggestions(prev => prev.filter(item => item.id !== sug.id));

    try {
      let token = null;
      try {
        const supa = (await import('../../lib/supabaseClient.js')).supabase;
        const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
        if (session?.access_token) token = session.access_token;
      } catch { }

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { based_on_id, relation_type } = sug.relation;

      await fetch(`/api/knowledge-objects/relations/${based_on_id}/${sug.id}/${relation_type}/dismiss`, {
        method: 'PATCH',
        headers
      });

      logActivity('suggestion_dismissed', `Relation dismissed: ${sug.name}`, 'Agency Team', 'knowledge_object', sug.id);
      toast.success('Recommendation dismissed');
    } catch (err) {
      console.error("Failed to dismiss relation:", err);
      toast.error('Failed to dismiss recommendation');
    }
  };

  // Load vault items from Supabase API — filtered by destination and budget for smart matching
  useEffect(() => {
    const dest = client?.destination || proposal?.destination || '';
    const budgetVal = client?.budget || proposal?.budget || 0;
    const params = new URLSearchParams();
    if (dest) params.set('destination', dest);
    if (budgetVal) params.set('budget', budgetVal);

    let isMounted = true;

    (async () => {
      try {
        let token = null;
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
          if (session?.access_token) token = session.access_token;
        } catch { }

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/vault/packages?${params.toString()}`, { headers });
        if (res.ok && isMounted) {
          const json = await res.json();
          const items = (json.packages || []).map(pkg => ({
            ...pkg,
            parsed_data: typeof pkg.parsed_data === 'string' ? JSON.parse(pkg.parsed_data) : pkg.parsed_data,
            extra_sections: typeof pkg.extra_sections === 'string' ? JSON.parse(pkg.extra_sections) : pkg.extra_sections,
          }));
          setVaultItems(items);
        }
      } catch {
        // Fallback to localStorage for offline demo
        try {
          const raw = JSON.parse(localStorage.getItem('voyanta_vault_items') || '[]');
          if (isMounted) setVaultItems(raw);
        } catch { }
      }
    })();

    return () => { isMounted = false; };
  }, [client?.destination, client?.budget, proposal?.destination]);

  const [generatingVI, setGeneratingVI] = useState(false);

  const handleGenerateWithVI = async () => {
    setGeneratingVI(true);
    const dest = proposal?.destination || client?.destination || 'Luxury Destination';

    // Determine dynamic duration from Step 1
    let numDays = 5; // fallback
    if (client?.date_mode === 'days' && client?.duration_days) {
      numDays = parseInt(client.duration_days, 10) || 5;
    } else if (client?.date_mode === 'dates' && client?.start_date && client?.end_date) {
      const ms = new Date(client.end_date).getTime() - new Date(client.start_date).getTime();
      const diffDays = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
      numDays = diffDays > 0 ? diffDays : 5;
    } else if (days.length > 0) {
      numDays = days.length;
    }

    const startDateStr = client?.start_date || new Date().toISOString();
    const climate = getClimateClassification(dest, startDateStr);

    toast.info(`Generating curated day-by-day itinerary via VI for ${dest} (${numDays} Days, ${climate.seasonName})...`);

    try {
      await new Promise(r => setTimeout(r, 600));

      if (days.length === 0) {
        // Global caching check
        const cacheKey = `itinerary_${dest.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${numDays}_${climate.seasonName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        let cachedDays = null;
        try {
          const globalCache = JSON.parse(localStorage.getItem('voyanta_global_vi_cache') || '{}');
          if (globalCache && globalCache[cacheKey]) {
            cachedDays = globalCache[cacheKey];
          }
        } catch (e) {
          console.warn('Failed to parse global VI cache:', e);
        }

        if (cachedDays && Array.isArray(cachedDays) && cachedDays.length === numDays) {
          updateProposal({ itinerary: { days: cachedDays } });
          logActivity('vi_itinerary_cached_hit', `VI retrieved cached ${numDays}-day itinerary for ${dest} (${climate.seasonName})`, client?.name || 'Agency Team');
          toast.success(`✨ VI retrieved pre-generated ${numDays}-day itinerary for ${dest} from global cache!`);
        } else {
          // Generate new days adaptively
          const genDays = buildVIItinerary(dest, numDays, startDateStr);
          updateProposal({ itinerary: { days: genDays } });

          // Save to global cache
          try {
            const globalCache = JSON.parse(localStorage.getItem('voyanta_global_vi_cache') || '{}');
            globalCache[cacheKey] = genDays;
            localStorage.setItem('voyanta_global_vi_cache', JSON.stringify(globalCache));
          } catch (e) {
            console.warn('Failed to save to global VI cache:', e);
          }

          logActivity('vi_itinerary_generated', `VI generated ${numDays}-day climate-intelligent itinerary for ${dest}`, client?.name || 'Agency Team');
          toast.success(`✨ VI generated a complete ${numDays}-day itinerary for ${dest} (${climate.seasonName})!`);
        }
      } else {
        const enriched = days.map(d => {
          let desc = d.description || `Curated luxury itinerary day exploring the finest highlights of ${dest} with private chauffeur and VIP privileges.`;

          // Climate adaptive descriptions check for existing days
          if (climate.isHot && climate.keyMatch !== 'kashmir') {
            // Avoid stroller or hot afternoon walks
            if (desc.toLowerCase().includes('walking') || desc.toLowerCase().includes('stroll') || desc.toLowerCase().includes('safari')) {
              desc = desc.replace(/stroll\b|strolling\b|walking tour\b/gi, 'private AC transport transfer')
                .replace(/afternoon excursion\b|afternoon stroll\b/gi, 'evening sunset cruise')
                .replace(/guided walking\b/gi, 'chauffeured museum exploration');
            }
            if (!desc.toLowerCase().includes('afternoon relaxation') && !desc.toLowerCase().includes('spa')) {
              desc += ' Spend the warm afternoon hours enjoying premium spa therapy or relaxing indoor amenities.';
            }
          }

          return {
            ...d,
            title: d.title?.includes('Day') ? d.title : `Exclusive Experience: ${d.title || dest}`,
            description: desc
          };
        });

        updateProposal({ itinerary: { days: enriched } });
        logActivity('vi_itinerary_enriched', `VI enriched ${days.length} itinerary days with climate intelligence`, client?.name || 'Agency Team');
        toast.success(`✨ VI enriched ${days.length} itinerary days with climate intelligence & Vault highlights!`);
      }
    } catch (err) {
      toast.error('Failed to generate with VI.');
    } finally {
      setGeneratingVI(false);
    }
  };

  const subDestinationsList = useMemo(() => {
    const set = new Set();
    // Collect actual sub-destinations from vault packages for this destination
    (vaultItems || []).forEach(vt => {
      const data = vt.parsed_data || vt;
      if (Array.isArray(data.sub_destinations)) data.sub_destinations.forEach(sd => set.add(sd));
      if (Array.isArray(vt.sub_destinations)) vt.sub_destinations.forEach(sd => set.add(sd));
    });
    // Add subDestinations retrieved from backend suggestions dynamically
    (subDestinations || []).forEach(sd => {
      const name = typeof sd === 'object' ? sd.name : sd;
      if (name) set.add(name);
    });
    return Array.from(set).map((name, idx) => ({
      id: `sub_${idx}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: name,
      location: client?.destination || proposal?.destination || '',
      description: `Real data from your vault — hotels, activities, meals, and transfers for ${name} will be imported from your uploaded PDFs.`,
      // Lookup vault data for this sub-destination for import
      vaultData: (() => {
        for (const vt of vaultItems) {
          const data = vt.parsed_data || vt;
          const matchDays = (data.days || []).filter(d => d.sub_destination === name || (d.title || '').includes(name));
          if (matchDays.length > 0) return { days: matchDays, currency: data.currency || vt.currency || 'INR' };
        }
        return null;
      })()
    }));
  }, [vaultItems, subDestinations, client?.destination, proposal?.destination]);


  // Duration-Driven Builder: Prepopulate days if empty
  useEffect(() => {
    Promise.all([
      hotelsService.list(),
      flightsService.list(),
      activitiesService.list()
    ]).then(([h, f, e]) => {
      setLibraryData({ hotels: h, flights: f, itinerary: e });
    }).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (days.length === 0) {
      let numDays = 0;
      if (client.date_mode === 'days' && client.duration_days) {
        numDays = parseInt(client.duration_days, 10) || 1;
      } else if (client.date_mode === 'dates' && client.start_date && client.end_date) {
        const ms = new Date(client.end_date).getTime() - new Date(client.start_date).getTime();
        const diffDays = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
        numDays = diffDays > 0 ? diffDays : 1;
      } else if (proposal?.id) {
        numDays = 1; // Fallback if saved but no dates
      }

      if (numDays > 0) {
        const nextDays = Array.from({ length: numDays }, (_, i) => ({
          day: i + 1,
          title: '',
          description: '',
          image_url: null,
          block_type: i === 0 ? 'arrival' : (i === numDays - 1 ? 'departure' : 'day')
        }));
        setProposal(prev => ({ ...(prev || {}), itinerary: { ...(prev?.itinerary || {}), days: nextDays } }));
      }
    }
  }, [days.length, proposal?.id, client.date_mode, client.duration_days, client.start_date, client.end_date, setProposal]);

  const updateDay = useCallback((index, patch) => {
    setProposal(prev => {
      const nextDays = [...(prev?.itinerary?.days || [])];
      nextDays[index] = { ...nextDays[index], ...patch };
      return { ...(prev || {}), itinerary: { ...(prev?.itinerary || {}), days: nextDays } };
    });
  }, [setProposal]);

  const removeDay = useCallback((index) => {
    if (!window.confirm('Are you sure you want to remove this day?')) return;
    setProposal(prev => {
      const nextDays = [...(prev?.itinerary?.days || [])];
      nextDays.splice(index, 1);
      nextDays.forEach((d, i) => d.day = i + 1);
      return { ...(prev || {}), itinerary: { ...(prev?.itinerary || {}), days: nextDays } };
    });
  }, [setProposal]);

  const addDay = useCallback(() => {
    setProposal(prev => {
      const nextDays = [...(prev?.itinerary?.days || [])];
      nextDays.push({
        day: nextDays.length + 1,
        title: '',
        description: '',
        image_url: null
      });
      return { ...(prev || {}), itinerary: { ...(prev?.itinerary || {}), days: nextDays } };
    });
  }, [setProposal]);

  // Inventory handling
  const defaultQtyFor = (kind) => {
    const travelers = (parseInt(client.num_adults, 10) || 0) + (parseInt(client.num_children, 10) || 0) || 1;
    if (kind === 'hotel') return 1; // 1 room default, nights handled in costing usually
    return travelers;
  };

  const onAddItemToDay = async (resourceItem, kind, dayIndex) => {
    let pid = proposal?.id;
    if (!pid) {
      try {
        const p = typeof saveDraft === 'function' ? await saveDraft(true) : await saveDraftBackground();
        pid = p?.id;
      } catch {
        toast.error('Could not auto-save draft');
        return;
      }
    }

    let label = '';
    let price = 0;

    if (kind === 'hotel') { label = resourceItem.name || resourceItem.label || 'Hotel'; }
    else if (kind === 'flight') { label = `${resourceItem.airline || 'Flight'} ${resourceItem.flight_no || ''} ${resourceItem.origin || ''}→${resourceItem.destination || ''}`.trim(); }
    else if (kind === 'activity') { label = resourceItem.name || resourceItem.label || 'Activity'; }
    else { label = resourceItem.name || resourceItem.label || `${kind.toUpperCase()} Item`; }
    price = extractPrice(resourceItem);

    try {
      const newItem = {
        kind, ref_id: resourceItem.id, label,
        qty: defaultQtyFor(kind), unit_price: price,
        currency: resourceItem.currency || 'INR',
        meta: { source: kind + 's', day: dayIndex + 1 }
      };

      // Optimistic save instead of blocking db call
      await addItemsOptimistic([newItem]);

      let blockData = null;
      const baseMeta = {
        id: resourceItem.id,
        rawItem: resourceItem,
        price: extractPrice(resourceItem)
      };
      if (kind === 'hotel') {
        blockData = {
          id: crypto.randomUUID(),
          type: 'hotel',
          data: {
            ...baseMeta,
            name: resourceItem.name,
            details: `${resourceItem.location || ''} ${resourceItem.category ? `· ${resourceItem.category}` : ''}`.trim(),
            image_url: resourceItem.cover_image || resourceItem.image_url || ''
          }
        };
      } else if (kind === 'flight') {
        blockData = {
          id: crypto.randomUUID(),
          type: 'flight',
          data: {
            ...baseMeta,
            name: `${resourceItem.airline || ''} ${resourceItem.flight_no || ''}`.trim(),
            details: `${resourceItem.origin || ''} to ${resourceItem.destination || ''} · ${resourceItem.class || ''}`.trim(),
            image_url: resourceItem.image_url || ''
          }
        };
      } else if (kind === 'activity') {
        blockData = {
          id: crypto.randomUUID(),
          type: 'activity',
          data: {
            ...baseMeta,
            name: resourceItem.name,
            details: `${resourceItem.location || ''} ${resourceItem.duration_hours ? `· ${resourceItem.duration_hours}h` : ''}`.trim(),
            image_url: resourceItem.image_url || ''
          }
        };
      }
      if (blockData) {
        const currentDay = days[dayIndex] || {};
        const currentContent = Array.isArray(currentDay.content) ? [...currentDay.content] : [];
        updateDay(dayIndex, { content: [...currentContent, blockData] });
      }

      toast.success(`Added ${label} to Day ${dayIndex + 1}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onRemoveProposalItem = async (itemId) => {
    try {
      const itemToRemove = items.find(x => x.id === itemId);
      await removeItem(itemId);
      setItems(s => s.filter(x => x.id !== itemId));
      toast.success('Removed item');
      if (itemToRemove && itemToRemove.ref_id) {
        logActivity('item_deleted_after_add', `Suggested item deleted: ${itemToRemove.label}`, 'Agency Team', 'knowledge_object', itemToRemove.ref_id);
      }
    } catch (e) { toast.error(e.message); }
  };

  const importSubDestinationToDay = async (subDestName, dayIndex) => {
    try {
      const pid = proposal?.id;
      if (!pid) {
        toast.error('Please save client draft in Step 1 first.');
        return;
      }
      const currentDay = days[dayIndex] || {};

      // Find real vault data for this sub-destination
      const subDest = subDestinationsList.find(s => s.name === subDestName);
      let vaultDayData = subDest?.vaultData?.days?.[0];
      const vaultCurrency = subDest?.vaultData?.currency || proposalCurrency || 'INR';

      const contentBlocks = [];
      const newItems = [];

      if (vaultDayData) {
        // ── Real vault data path — import ACTUAL hotel/activity/meal/transfer from PDF ──
        (vaultDayData.hotels || []).forEach(h => {
          const price = h.price_per_night || h.price || 0;
          contentBlocks.push({ id: crypto.randomUUID(), type: 'hotel', data: { name: h.name, category: h.category, price_per_night: price, location: h.location || subDestName, image_url: h.image_url || '' } });
          newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'hotel', label: h.name, details: h.location || subDestName, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
        });
        (vaultDayData.activities || []).forEach(a => {
          const price = a.price || 0;
          contentBlocks.push({ id: crypto.randomUUID(), type: 'activity', data: { name: a.name, duration: a.duration, timing: a.timing, price, location: a.location || subDestName, image_url: a.image_url || '', description: a.description } });
          newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'activity', label: a.name, details: a.location || subDestName, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
        });
        (vaultDayData.transfers || []).forEach(tr => {
          const price = tr.price || 0;
          contentBlocks.push({ id: crypto.randomUUID(), type: 'transfer', data: { name: tr.type || 'Transfer', vehicle_type: tr.vehicle, price, from: tr.from || subDestName, to: tr.to, timing: tr.timing } });
          newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'transfer', label: tr.type || 'Transfer', details: `${tr.from || subDestName} → ${tr.to || ''}`, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
        });
        (vaultDayData.meals || []).forEach(m => {
          const price = m.price || 0;
          contentBlocks.push({ id: crypto.randomUUID(), type: 'meal', data: { venue: m.venue || m.type, type: m.type, price, image_url: m.image_url || '' } });
          newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'meal', label: m.venue || m.type, details: m.cuisine || '', qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
        });
      } else {
        // Fallback: Query knowledge objects matching this subDestName (area) dynamically from database
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: objects } = await supa
            .from('knowledge_objects')
            .select('*')
            .eq('is_active', true)
            .ilike('destination', `%${proposal?.destination}%`)
            .eq('area', subDestName);

          if (objects && objects.length > 0) {
            objects.forEach(obj => {
              const attrs = obj.attributes || {};
              const price = cleanPrice(attrs.price_per_night || attrs.price || attrs.cost || 0);
              const img = attrs.photos?.[0] || attrs.image_url || '';
              if (obj.object_type === 'hotel') {
                contentBlocks.push({ id: crypto.randomUUID(), type: 'hotel', data: { name: obj.name, category: attrs.star_rating || '', price_per_night: price, location: obj.area || subDestName, image_url: img } });
                newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'hotel', label: obj.name, details: obj.area || subDestName, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
              } else if (obj.object_type === 'activity') {
                contentBlocks.push({ id: crypto.randomUUID(), type: 'activity', data: { name: obj.name, duration: attrs.duration || '', timing: attrs.timing || '', price, location: obj.area || subDestName, image_url: img, description: attrs.description || '' } });
                newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'activity', label: obj.name, details: obj.area || subDestName, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
              } else if (obj.object_type === 'transfer') {
                contentBlocks.push({ id: crypto.randomUUID(), type: 'transfer', data: { name: obj.name, vehicle_type: attrs.vehicle || '', price, from: attrs.from || subDestName, to: attrs.to || '' } });
                newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: 'transfer', label: obj.name, details: `${attrs.from || subDestName} → ${attrs.to || ''}`, qty: 1, unit_price: price, total_price: price, currency: vaultCurrency, meta: { day: dayIndex + 1 } });
              }
            });
          }
        } catch (dbErr) {
          console.error("Failed to fetch matching atomic objects from DB:", dbErr);
        }
      }

      if (contentBlocks.length > 0) {
        const currentContent = Array.isArray(currentDay.content) ? [...currentDay.content] : [];
        updateDay(dayIndex, {
          title: vaultDayData?.title || `Day in ${subDestName}`,
          description: vaultDayData?.description || `Explore the beautiful sights and experiences in ${subDestName}.`,
          content: [...currentContent, ...contentBlocks]
        });
        if (addItemsOptimistic && newItems.length > 0) addItemsOptimistic(newItems);
        toast.success(`Imported ${contentBlocks.length} items for ${subDestName} from Vault!`);
      } else {
        const currentContent = Array.isArray(currentDay.content) ? [...currentDay.content] : [];
        updateDay(dayIndex, {
          title: `Day in ${subDestName}`,
          description: `Itinerary for ${subDestName}. Add hotels, activities, meals, and transfers.`,
          content: currentContent
        });
        toast.info(`No vault items found for "${subDestName}" yet. You can add them manually to this day.`);
      }
    } catch (err) { toast.error('Failed to import: ' + err.message); }
  };


  const handleReferenceChange = (val) => {
    if (!val) {
      onApplyItinerary('');
      return;
    }
    if (val.startsWith('vault_')) {
      const vid = val.replace('vault_', '');
      const vt = (vaultItems || []).find(v => String(v.id) === String(vid) || String(v.option_id) === String(vid));
      if (vt && Array.isArray(vt.days)) {
        const pid = proposal?.id;
        if (!pid) { toast.error('Please save client info in Step 1 first.'); return; }
        const mappedDays = vt.days.map((d, i) => {
          const contentBlocks = [];
          (d.hotels || []).forEach(h => contentBlocks.push({ id: crypto.randomUUID(), type: 'hotel', data: h }));
          (d.activities || []).forEach(a => contentBlocks.push({ id: crypto.randomUUID(), type: 'activity', data: a }));
          (d.transfers || []).forEach(tr => contentBlocks.push({ id: crypto.randomUUID(), type: 'transfer', data: tr }));
          (d.meals || []).forEach(m => contentBlocks.push({ id: crypto.randomUUID(), type: 'meal', data: m }));
          return { id: crypto.randomUUID(), day: d.day_number || i + 1, title: d.title || `Day ${i + 1}`, description: d.description || '', image_url: (d.hotels?.[0]?.image_url) || (d.activities?.[0]?.image_url) || null, content: contentBlocks };
        });
        setProposal(p => ({ ...p, itinerary: { days: mappedDays }, destination: vt.destination || p?.destination }));
        if (addItemsOptimistic) {
          const newItems = [];
          mappedDays.forEach((md, idx) => {
            md.content.forEach(blk => {
              const p = Number(blk.data?.price_per_night ?? blk.data?.price ?? 0);
              newItems.push({ id: crypto.randomUUID(), proposal_id: pid, kind: blk.type === 'hotel' ? 'hotel' : blk.type === 'transfer' ? 'transfer' : blk.type === 'meal' ? 'meal' : 'activity', label: blk.data?.name || blk.data?.venue || 'Item', details: blk.data?.location || blk.data?.details || '', qty: 1, unit_price: p, total_price: p, currency: proposalCurrency, meta: { day: idx + 1 } });
            });
          });
          if (newItems.length > 0) addItemsOptimistic(newItems);
        }
        toast.success(`Loaded ${vt.option_title || 'Vault Tour'} with ${mappedDays.length} days and inventory!`);
      }
    } else {
      onApplyItinerary(val);
    }
  };

  const baseItems = activeTab === 'sub_destinations' ? subDestinationsList : libraryData[activeTab] || [];
  const filteredItems = baseItems.filter(item => {
    const term = search.toLowerCase();
    if (activeTab === 'sub_destinations') return item.name?.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term);
    if (activeTab === 'hotels') return item.name?.toLowerCase().includes(term) || item.location?.toLowerCase().includes(term);
    if (activeTab === 'flights') return item.airline?.toLowerCase().includes(term) || item.flight_no?.toLowerCase().includes(term);
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl relative items-start" data-testid="step-2">

      {/* Left Column: Timeline Builder */}
      <div className="lg:col-span-8 min-w-0 space-y-xl">
        <div className="glass-card rounded-2xl p-lg space-y-md border border-outline-variant/50">
          <div className="flex items-center justify-between gap-md flex-wrap">
            <h3 className="font-headline-sm text-primary">Proposal Itinerary</h3>
            <button
              type="button"
              onClick={handleGenerateWithVI}
              disabled={generatingVI}
              data-testid="generate-with-vi-btn"
              className="px-md py-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl font-label-md flex items-center gap-2 font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] ${generatingVI ? 'animate-spin' : ''}`}>
                {generatingVI ? 'progress_activity' : 'auto_awesome'}
              </span>
              {generatingVI ? 'Generating…' : 'Generate Day-by-Day with VI'}
            </button>
          </div>

        </div>

        <div className="space-y-sm pt-md">
          {days.length === 0 && (
            <div className="text-center py-xl border-2 border-dashed border-outline-variant rounded-2xl text-on-surface-variant bg-white/50">
              <span className="material-symbols-outlined text-[48px] mb-md opacity-50">timeline</span>
              <p className="font-label-md">No days added yet.</p>
              <p className="font-body-sm text-sm mb-md">Import a reference itinerary or add your first day below.</p>
            </div>
          )}

          {days.map((dayData, i) => {
            const dayItems = items.filter(it => it.meta?.day === i + 1);
            return (
              <DayBlock
                key={i}
                index={i}
                dayData={dayData}
                updateDay={updateDay}
                removeDay={removeDay}
                items={dayItems}
                onRemoveItem={onRemoveProposalItem}
                onAddResourceItem={onAddItemToDay}
                proposalDestination={proposal?.destination}
                tourType={proposal?.tour_type || proposal?.preferences?.tour_type || ''}
              />
            );
          })}

          <div className="pl-xl pt-lg pb-36">
            <button onClick={addDay} className="flex items-center gap-xs px-xl py-md bg-surface-container-highest text-primary font-label-md rounded-full hover:bg-primary hover:text-on-primary transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Day {days.length + 1}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Inventory Library Sidebar */}
      <div className="lg:col-span-4 sticky top-6 space-y-md h-[calc(100vh-120px)] flex flex-col">


        {/* Suggested from your Vault Panel */}
        <div className="glass-card rounded-2xl border border-outline-variant/50 overflow-hidden flex flex-col h-full shadow-lg">
          <div className="p-md border-b border-outline-variant/50 bg-white/50 backdrop-blur-md flex items-center justify-between">
            <h4 className="font-label-md text-on-surface uppercase tracking-widest flex items-center gap-xs font-semibold">
              <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
              Suggested from Vault
            </h4>
          </div>

          <div className="flex-1 overflow-y-auto p-md space-y-sm bg-gradient-to-b from-white/50 to-transparent">
            {/* Suggested Sub-Destinations Section */}
            {subDestinationsList.length > 0 && (
              <div className="pb-md mb-md border-b border-outline-variant/50 space-y-sm">
                <h5 className="font-label-sm text-on-surface uppercase tracking-widest flex items-center gap-xs font-semibold px-xs text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">explore</span>
                  Suggested Sub-Destinations
                </h5>
                <div className="grid grid-cols-1 gap-xs">
                  {subDestinationsList.map(sub => (
                    <div key={sub.id} className="bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl p-md shadow-xs transition-all flex flex-col gap-xs group">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Sub-Destination</span>
                        <span className="text-[10px] text-on-surface-variant font-medium">{sub.location}</span>
                      </div>
                      <p className="font-label-md text-on-surface font-semibold">{sub.name}</p>
                      <div className="mt-xs pt-xs border-t border-primary/10">
                        <select
                          className="w-full text-xs py-1.5 px-2 bg-primary/20 hover:bg-primary/30 rounded border-none focus:ring-1 focus:ring-primary cursor-pointer text-primary font-bold"
                          onChange={(e) => {
                            if (e.target.value !== '') {
                              importSubDestinationToDay(sub.name, parseInt(e.target.value));
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">+ Import to Day...</option>
                          {days.map((d, i) => (
                            <option key={i} value={i}>Day {d.day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Recommendations Section */}
            <h5 className="font-label-sm text-on-surface uppercase tracking-widest flex items-center gap-xs font-semibold px-xs text-xs pb-sm">
              <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
              Recommended Items
            </h5>

            {suggestionsLoading ? (
              <div className="space-y-sm">
                {[1, 2].map(n => (
                  <div key={n} className="bg-white border border-outline-variant rounded-xl p-md animate-pulse space-y-sm">
                    <div className="h-3 w-16 bg-outline-variant rounded"></div>
                    <div className="h-4 w-3/4 bg-outline-variant rounded"></div>
                    <div className="flex gap-xs">
                      <div className="h-4 w-12 bg-outline-variant rounded-full"></div>
                      <div className="h-4 w-12 bg-outline-variant rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-lg text-on-surface-variant bg-surface-container-lowest/50 rounded-xl border border-dashed border-outline-variant p-md">
                <p className="text-xs leading-relaxed">No vault matches yet for this destination — add hotels/activities manually and they'll be remembered next time.</p>
              </div>
            ) : (
              suggestions.map(sug => (
                <div key={sug.id} className="bg-white border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-all flex flex-col gap-xs group">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${sug.object_type === 'hotel' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                      {sug.object_type}
                    </span>
                    {sug.area && <span className="text-[10px] text-on-surface-variant font-medium">{sug.area}</span>}
                  </div>
                  <p className="font-label-md text-on-surface font-semibold">{sug.name}</p>
                  <BestRateChip objId={sug.id} />

                  {sug.matched_tags && sug.matched_tags.length > 0 && (
                    <div className="flex flex-wrap gap-xs my-1">
                      {sug.matched_tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-surface-container text-on-surface text-[10px] rounded-full border border-outline-variant/30 font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-xs pt-xs border-t border-outline-variant/50">
                    <select
                      className="w-full text-xs py-1 px-2 bg-primary/10 hover:bg-primary/20 rounded border-none focus:ring-1 focus:ring-primary cursor-pointer text-primary font-bold"
                      onChange={(e) => {
                        if (e.target.value !== '') {
                          const resItem = {
                            id: sug.id,
                            name: sug.name,
                            currency: sug.attributes?.currency || 'INR',
                            price_per_night: sug.attributes?.price_per_night || sug.attributes?.price || 0,
                            price: sug.attributes?.price || sug.attributes?.cost || 0,
                            location: sug.destination || '',
                            category: sug.attributes?.star_rating || '',
                            duration_hours: sug.attributes?.duration || ''
                          };
                          addedRef.current.add(sug.id);
                          logActivity('suggestion_added', `Suggestion added: ${sug.name}`, 'Agency Team', 'knowledge_object', sug.id);
                          onAddItemToDay(resItem, sug.object_type, parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">+ Add to Day...</option>
                      {days.map((d, i) => (
                        <option key={i} value={i}>Day {d.day}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}

            {/* Related Suggestions */}
            {relatedSuggestions && relatedSuggestions.length > 0 && (
              <div className="pt-md border-t border-outline-variant/50 space-y-sm">
                <h5 className="font-label-sm text-on-surface uppercase tracking-widest flex items-center gap-xs font-semibold px-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">join_inner</span>
                  Goes well with what you just added
                </h5>
                <div className="space-y-sm animate-fade-in">
                  {relatedSuggestions.map(sug => (
                    <div key={sug.id} className="bg-white border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-all flex flex-col gap-xs group">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${sug.object_type === 'hotel' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                          {sug.object_type}
                        </span>

                        <div className="flex items-center gap-xs">
                          {sug.relation && (
                            <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded uppercase tracking-wider">
                              {sug.relation.relation_type === 'nearby'
                                ? `Nearby (${sug.relation.distance_minutes}m)`
                                : 'Pairs Well'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDismissRelation(sug)}
                            title="Dismiss recommendation"
                            className="text-on-surface-variant hover:text-error flex items-center justify-center p-0.5 rounded-full hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      </div>

                      <p className="font-label-md text-on-surface font-semibold">{sug.name}</p>

                      {sug.relation && (
                        <p className="text-[10px] text-on-surface-variant italic">
                          Based on: {sug.relation.based_on_name}
                        </p>
                      )}

                      <BestRateChip objId={sug.id} />

                      <div className="mt-xs pt-xs border-t border-outline-variant/50">
                        <select
                          className="w-full text-xs py-1 px-2 bg-primary/10 hover:bg-primary/20 rounded border-none focus:ring-1 focus:ring-primary cursor-pointer text-primary font-bold"
                          onChange={(e) => {
                            if (e.target.value !== '') {
                              const resItem = {
                                id: sug.id,
                                name: sug.name,
                                currency: sug.attributes?.currency || 'INR',
                                price_per_night: sug.attributes?.price_per_night || sug.attributes?.price || 0,
                                price: sug.attributes?.price || sug.attributes?.cost || 0,
                                location: sug.destination || '',
                                category: sug.attributes?.star_rating || '',
                                duration_hours: sug.attributes?.duration || ''
                              };
                              addedRef.current.add(sug.id);
                              logActivity('suggestion_added', `Related suggestion added: ${sug.name}`, 'Agency Team', 'knowledge_object', sug.id);
                              onAddItemToDay(resItem, sug.object_type, parseInt(e.target.value));
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">+ Add to Day...</option>
                          {days.map((d, i) => (
                            <option key={i} value={i}>Day {d.day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}

function BestRateChip({ objId }) {
  const [bestRate, setBestRate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!objId) return;
    let isMounted = true;
    setLoading(true);

    (async () => {
      try {
        let token = null;
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
          const { data: { session } } = await supa?.auth?.getSession?.() || { data: { session: null } };
          if (session?.access_token) token = session.access_token;
        } catch { }

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/knowledge-objects/${objId}/best-rate`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.best_rate) {
            setBestRate(data.best_rate);
          }
        }
      } catch (err) {
        console.error("Failed to load best rate:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [objId]);

  if (loading || !bestRate) return null;

  return (
    <div className="inline-flex items-center gap-xs px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 shadow-sm animate-fade-in no-print mt-1">
      <span className="material-symbols-outlined text-[12px] text-emerald-600">auto_awesome</span>
      <span>best rate: {bestRate.currency === 'INR' ? '₹' : bestRate.currency}{bestRate.rate.toLocaleString()} via {bestRate.supplier_name}</span>
    </div>
  );
}
