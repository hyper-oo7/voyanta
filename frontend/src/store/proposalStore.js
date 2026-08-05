import { create } from 'zustand';
import { fetchProposalById, updateProposal, createProposal } from '../services/proposalService.js';
import { listItems, addItem, removeItem, updateItem } from '../services/proposalItemService.js';
import { DEFAULT_COUNTRY } from '../lib/countries.js';
import { sanitizeBrandingObject } from '../services/resourceService.js';
import { executeRAGQuery } from '../services/api.js';
import { matchVaultResources } from '../services/resourceMatchingService.js';
import { assembleProposal } from '../services/assemblyService.js';

const saveLocalBackup = (state) => {
  try {
    const id = state.proposal?.id || state.activeId;
    if (id) {
      const draft = {
        id,
        client: state.client,
        branding: state.branding,
        costingPrefs: state.costingPrefs,
        proposal: state.proposal,
        items: state.items,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(`voyanta_proposal_draft_${id}`, JSON.stringify(draft));
      localStorage.setItem('voyanta_active_proposal_id', id);
    }
  } catch {}
};

/* ------------------------------------------------------------------ */
/*  Vault-aware local fallback builder                                */
/* ------------------------------------------------------------------ */

function buildProposalFromVault(intakeData, vault) {
  const daysCount = Math.max(1, intakeData.duration_days || 3);
  const travelers = Math.max(1, intakeData.num_travelers || 2);
  const hotels = vault.hotels || [];
  const activities = vault.activities || [];
  const flights = vault.flights || [];
  const destination = intakeData.destination || 'Destination';

  const days = [];

  for (let i = 1; i <= daysCount; i++) {
    // Rotate through available hotels
    const hotel = hotels.length > 0 ? hotels[(i - 1) % hotels.length] : null;

    // Distribute activities evenly (2–3 per day)
    const actsPerDay = Math.max(1, Math.min(3, Math.ceil(activities.length / daysCount)));
    const startIdx = (i - 1) * actsPerDay;
    const dayActivities = [];
    for (let j = 0; j < actsPerDay; j++) {
      const act = activities[startIdx + j];
      if (act) dayActivities.push(act);
    }

    // Flights: arrival on day 1, departure on last day
    const dayFlights = [];
    if (i === 1 && flights.length > 0) dayFlights.push(flights[0]);
    if (i === daysCount && flights.length > 1) dayFlights.push(flights[1]);

    // Day pricing
    let dayPrice = 0;
    if (hotel) dayPrice += (hotel.price_per_night || 0);
    dayActivities.forEach((a) => (dayPrice += (a.price || 0) * travelers));
    dayFlights.forEach((f) => (dayPrice += (f.cost || 0) * travelers));

    days.push({
      day_number: i,
      title: `Day ${i}: ${destination} Experience`,
      description: `Explore ${destination} with curated activities${hotel ? ` and stay at ${hotel.name}` : ''}.`,
      sub_destination: destination,
      hotels: hotel
        ? [
            {
              id: hotel.id,
              name: hotel.name,
              category: hotel.category || '4 Star',
              meal_plan: hotel.meal_type || 'CP (Breakfast)',
              price_per_night: hotel.price_per_night || 0,
              location: hotel.location,
              image_url: hotel.image_url,
            },
          ]
        : [],
      activities: dayActivities.map((a) => ({
        id: a.id,
        name: a.name,
        duration: a.duration_hours ? `${a.duration_hours} hrs` : '3 hrs',
        timing: a.timing || '10:00 AM',
        price: a.price || 0,
        location: a.location,
        description: a.description || '',
      })),
      flights: dayFlights.map((f) => ({
        id: f.id,
        airline: f.airline,
        flight_no: f.flight_no,
        origin: f.origin,
        destination: f.destination,
        cost: f.cost || 0,
        class: f.class || 'Economy',
      })),
      day_total: dayPrice,
    });
  }

  const totalPrice = days.reduce((sum, d) => sum + d.day_total, 0);
  const pricePerPerson = travelers > 0 ? Math.round(totalPrice / travelers) : totalPrice;

  return {
    id: `prop_${Date.now()}`,
    name: `${destination} Itinerary`,
    destination,
    duration_days: daysCount,
    total_price: totalPrice,
    price_per_person: pricePerPerson,
    currency: 'INR',
    overview: `Curated ${daysCount}-day itinerary for ${intakeData.client_name || 'Valued Traveler'} to ${destination}.`,
    days,
    inclusions: ['Private AC Car', 'Hotel with Breakfast', 'Taxes & Driver Allowances'],
    exclusions: ['Flight / Train', 'Personal Expenses'],
    extra_sections: {},
    vault_sourced: true,
    generated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useProposalStore = create((set, get) => ({
  // State
  activeId: localStorage.getItem('voyanta_active_proposal_id') || null,
  proposal: null,
  items: [],
  recommendationOptions: [],
  client: {
    customer_name: '', phone: '', country: DEFAULT_COUNTRY, email: '',
    destination: '',
    date_mode: 'days',
    start_date: '', end_date: '',
    duration_days: 5, duration_nights: 4,
    arrival_city: '', arrival_airport: '',
    departure_city: '', departure_airport: '',
    num_adults: 1, num_children: 0, budget: '', special_notes: '',
    itinerary_id: '',
    tour_type: '',
    dietary: '',
    pace: '',
    dislikes: [],
  },
  branding: {
    agency_name: '', logo_url: '', address: '',
    contact_email: '', contact_phone: '', website: '',
    social_facebook: '', social_instagram: '', social_linkedin: '',
    cover_image_url: '', highlights: '',
    inclusions: '', exclusions: '', terms_of_payment: '',
    template_style: 'classic',
    custom_fields: []
  },
  costingPrefs: {
    fixed_markup: 0,
    pct_markup: 15,
    discount: 0,
    tax: 5,
    margin_type: 'percentage',
    margin_value: 15,
    visibility_mode: 'ITEMIZED'
  },
  viewMode: 'web',
  showTemplateGallery: false,
  showQuickIntake: false,
  activeTemplateSlug: 'classic',
  status: 'idle',

  // Canvas Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowTemplateGallery: (show) => set({ showTemplateGallery: show }),
  setShowQuickIntake: (show) => set({ showQuickIntake: show }),
  setTemplateSlug: (slug) => set((state) => {
    const nextBranding = { ...state.branding, template_style: slug };
    const nextProposal = state.proposal ? { ...state.proposal, template_style: slug } : state.proposal;
    saveLocalBackup({ ...state, branding: nextBranding, proposal: nextProposal });
    return { activeTemplateSlug: slug, branding: nextBranding, proposal: nextProposal };
  }),

  /* ── ONE-SHOT ASSEMBLY (RAG + Vault integrated) ───────────────── */
  assemble1Shot: async (intakeData) => {
    set({ status: 'loading' });

    try {
      // 1. Parallel retrieval: RAG context + Vault resources
      const [ragRes, vaultMatches] = await Promise.all([
        executeRAGQuery({
          agency_id: intakeData.agency_id || 'demo-agency',
          destination: intakeData.destination,
          duration_days: intakeData.duration_days,
          travelers: intakeData.num_travelers,
          travel_style: intakeData.pace || 'medium',
          budget_inr: intakeData.budget_per_head,
          special_requests: intakeData.special_notes || '',
        }).catch((err) => {
          console.warn('[1-Shot] RAG query failed, continuing without doc context:', err);
          return { data: { chunks: [], query: '' } };
        }),

        matchVaultResources({
          destination: intakeData.destination,
          budgetPerHead: intakeData.budget_per_head,
          travelers: intakeData.num_travelers,
          durationDays: intakeData.duration_days,
          travelStyle: intakeData.pace,
        }).catch((err) => {
          console.warn('[1-Shot] Vault matching failed:', err);
          return { hotels: [], activities: [], flights: [], templates: [] };
        }),
      ]);

      const ragChunks = ragRes?.data?.chunks || [];
      const ragQuery = ragRes?.data?.query || '';

      // 2. Call assembly API with full grounding context via assembleProposal service
      const p = await assembleProposal(
        intakeData,
        { chunks: ragChunks, assembled_query: ragQuery },
        vaultMatches,
        get().costingPrefs
      );

      if (p) {
        // Normalize schema mismatch: Backend sends days in p.days, Frontend expects them in p.itinerary.days
        if (p.days && p.days.length > 0 && (!p.itinerary || !p.itinerary.days)) {
          p.itinerary = { ...(p.itinerary || {}), days: p.days };
        }

        const nextClient = {
          ...get().client,
          customer_name: intakeData.client_name || 'Valued Traveler',
          destination: p.destination || intakeData.destination,
          duration_days: p.duration_days || intakeData.duration_days,
          pace: intakeData.pace || 'medium',
          budget: intakeData.budget_per_head || '',
          start_date: intakeData.start_date || '',
          end_date: intakeData.end_date || '',
        };

        set({
          proposal: p,
          client: nextClient,
          status: 'idle',
          showQuickIntake: false,
        });
        saveLocalBackup(get());
        return p;
      }
    } catch (err) {
      console.warn('[1-Shot Store] Assembly API error, building from vault fallback:', err);

      // 3. Local fallback: build from ACTUAL vault resources (no hallucinations)
      const vaultMatches = await matchVaultResources({
        destination: intakeData.destination,
        budgetPerHead: intakeData.budget_per_head,
        travelers: intakeData.num_travelers,
        durationDays: intakeData.duration_days,
        travelStyle: intakeData.pace,
      }).catch(() => ({ hotels: [], activities: [], flights: [] }));

      if (vaultMatches.hotels.length > 0 || vaultMatches.activities.length > 0) {
        const fallbackProposal = buildProposalFromVault(intakeData, vaultMatches);

        set({
          proposal: fallbackProposal,
          client: {
            ...get().client,
            customer_name: intakeData.client_name || 'Valued Traveler',
            destination: intakeData.destination,
            start_date: intakeData.start_date,
            end_date: intakeData.end_date,
          },
          status: 'idle',
          showQuickIntake: false,
        });
        saveLocalBackup(get());
        return fallbackProposal;
      }

      // Absolute last resort: hard error, no fake data
      set({ status: 'error' });
      throw new Error(
        'Unable to generate itinerary. No vault resources found for this destination. ' +
        'Please upload supplier PDFs or add hotels / activities to your library first.'
      );
    }
  },

  // Actions
  setActiveId: (id) => {
    if (id) {
      localStorage.setItem('voyanta_active_proposal_id', id);
    } else {
      localStorage.removeItem('voyanta_active_proposal_id');
    }
    set({ activeId: id });
  },

  setClient: (partialClient) => set((state) => {
    const nextClient = typeof partialClient === 'function' ? partialClient(state.client) : { ...state.client, ...partialClient };
    saveLocalBackup({ ...state, client: nextClient });
    return { client: nextClient };
  }),

  setBranding: (partialBranding) => set((state) => {
    const nextBranding = sanitizeBrandingObject(typeof partialBranding === 'function' ? partialBranding(state.branding) : { ...state.branding, ...partialBranding });
    saveLocalBackup({ ...state, branding: nextBranding });
    return { branding: nextBranding };
  }),

  setCostingPrefs: (partialCosting) => set((state) => {
    const nextCosting = typeof partialCosting === 'function' ? partialCosting(state.costingPrefs) : { ...state.costingPrefs, ...partialCosting };
    saveLocalBackup({ ...state, costingPrefs: nextCosting });
    return { costingPrefs: nextCosting };
  }),

  setProposal: (partialProposal) => set((state) => {
    const nextProposal = typeof partialProposal === 'function' ? partialProposal(state.proposal) : { ...state.proposal, ...partialProposal };
    saveLocalBackup({ ...state, proposal: nextProposal });
    return { proposal: nextProposal };
  }),

  updateProposal: (partialProposal) => {
    get().setProposal(partialProposal);
  },

  setItems: (newItems) => set((state) => {
    const nextItems = typeof newItems === 'function' ? newItems(state.items) : newItems;
    saveLocalBackup({ ...state, items: nextItems });
    return { items: nextItems };
  }),

  loadProposal: async (id) => {
    if (!id) {
      if (!get().activeId) get().setActiveId(crypto.randomUUID());
      set({ proposal: null, items: [], status: 'idle' });
      return;
    }
    set({ status: 'loading' });
    try {
      let p = null;
      let its = [];
      try {
        [p, its] = await Promise.all([fetchProposalById(id), listItems(id)]);
      } catch (dbErr) {
        console.warn('DB fetch failed, falling back to local backup:', dbErr);
      }
      if (!p) {
        try {
          const draftStr = localStorage.getItem(`voyanta_proposal_draft_${id}`) || localStorage.getItem(`voyanta_proposal_${id}`);
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            p = draft.proposal || draft;
            its = draft.items || [];
          }
        } catch {}
      }
      if (p) {
        get().setActiveId(p.id || id);
        const b = p.brief || {};

        const { settingsService } = await import('../services/resourceService.js');
        const defaultSettings = await settingsService.get().catch(() => ({})) || {};

        const rawBranding = { ...get().branding, ...(p.preferences?.branding || {}) };

        const mergedBranding = {
          ...rawBranding,
          agency_name: rawBranding.agency_name || defaultSettings.agency_name || '',
          logo_url: rawBranding.logo_url || defaultSettings.logo_url || '',
          address: rawBranding.address || defaultSettings.address || '',
          contact_email: rawBranding.contact_email || defaultSettings.contact_email || '',
          contact_phone: rawBranding.contact_phone || defaultSettings.contact_phone || '',
          website: rawBranding.website || defaultSettings.website || '',
          social_facebook: rawBranding.social_facebook || defaultSettings.social_facebook || '',
          social_instagram: rawBranding.social_instagram || defaultSettings.social_instagram || '',
          social_linkedin: rawBranding.social_linkedin || defaultSettings.social_linkedin || '',
        };
        const cleanBranding = sanitizeBrandingObject(mergedBranding);

        set({
          proposal: p,
          items: its || [],
          client: {
            client_id: p.client_id || b.client_id || '',
            customer_name: p.client_name || p.name || '',
            phone: b.phone || p.phone || p.client_phone || '',
            country: b.country || DEFAULT_COUNTRY,
            email: b.email || p.email || p.client_email || '',
            destination: p.destination || '',
            start_date: p.start_date || '',
            end_date: p.end_date || '',
            date_mode: b.date_mode || 'days',
            duration_days: b.duration_days || 5,
            duration_nights: b.duration_nights || 4,
            arrival_city: p.arrival_city || '',
            arrival_airport: p.arrival_airport || '',
            departure_city: p.departure_city || '',
            departure_airport: p.departure_airport || '',
            num_adults: b.num_adults ?? p.travelers ?? 1,
            num_children: b.num_children ?? 0,
            budget: p.budget_max ?? '',
            special_notes: b.special_notes || '',
            itinerary_id: b.itinerary_id || '',
            tour_type: b.tour_type || '',
            dietary: b.dietary || '',
            pace: b.pace || '',
            dislikes: b.dislikes || [],
          },
          branding: cleanBranding,
          costingPrefs: { ...get().costingPrefs, ...(p.preferences?.costing || {}) },
          status: 'idle'
        });
      } else {
        set({ status: 'idle' });
      }
    } catch (error) {
      console.error('Failed to load proposal', error);
      set({ status: 'error' });
      throw error;
    }
  },

  buildPayload: () => {
    const { client: rawClient, branding, costingPrefs, proposal } = get();
    const c = rawClient || {};
    const travelers = (parseInt(c.num_adults, 10) || 0) + (parseInt(c.num_children, 10) || 0);

    let overrides = {};
    try {
      const pid = proposal?.id || get().activeId;
      if (pid) {
        overrides = JSON.parse(localStorage.getItem(`voyanta_overrides_${pid}`) || '{}');
      }
    } catch {}

    return {
      client_id: c.client_id || c.id || proposal?.client_id || null,
      name: proposal?.name || (c.destination ? `${c.destination}${c.tour_type ? ' ' + c.tour_type : ' Itinerary'}` : 'Travel Proposal'),
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
      currency: proposal?.currency || 'INR',
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
        dietary: c.dietary || '',
        pace: c.pace || '',
        dislikes: c.dislikes || [],
      },
      preferences: {
        ...(proposal?.preferences || {}),
        branding,
        costing: costingPrefs,
        overrides: {
          ...(proposal?.preferences?.overrides || {}),
          ...overrides
        }
      },
      itinerary: proposal?.itinerary,
      status: proposal?.status || 'Draft',
      visibility_mode: proposal?.visibility_mode || 'ITEMIZED',
    };
  },

  saveDraftBackground: async () => {
    if (get().status === 'saving') {
      return get().proposal;
    }
    set({ status: 'saving' });
    try {
      const payload = get().buildPayload();
      const currentId = get().proposal?.id || get().activeId;
      let p;
      if (currentId) {
        p = await updateProposal(currentId, payload);
      } else {
        p = await createProposal(payload);
        get().setActiveId(p.id);
      }
      set({ proposal: { ...get().proposal, ...p }, status: 'idle' });
      return p;
    } catch (e) {
      set({ status: 'error' });
      throw e;
    }
  },

  addItemsOptimistic: async (newItemsToInsert) => {
    const previousItems = [...get().items];
    const pid = get().proposal?.id;
    if (!pid) throw new Error('No active proposal');

    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const optimisticItems = newItemsToInsert.map((item) => {
      const checkId = item.id;
      const validId = isUuid(checkId) ? checkId : crypto.randomUUID();
      const validRefId = item.ref_id || (!isUuid(checkId) && checkId ? checkId : undefined);
      const resItem = {
        ...item,
        id: validId,
        proposal_id: pid
      };
      if (validRefId) {
        resItem.ref_id = validRefId;
      }
      return resItem;
    });
    set({ items: [...previousItems, ...optimisticItems] });

    try {
      const addedResults = await Promise.all(optimisticItems.map((item) => addItem(pid, item)));
      set((state) => ({
        items: state.items.map((it) => {
          const matched = addedResults.find((r) => r && String(r.id) === String(it.id));
          if (matched) {
            return { ...matched, label: it.label, qty: it.qty, unit_price: it.unit_price };
          }
          return it;
        })
      }));
    } catch (err) {
      console.warn('Supabase sync failed for proposal items, preserving items in offline draft:', err);
      try {
        const norm = { ...get().proposal, items: get().items };
        localStorage.setItem(`voyanta_proposal_${pid}`, JSON.stringify(norm));
      } catch {}
    }
  },

  removeItemOptimistic: async (itemId) => {
    const previousItems = [...get().items];
    const pid = get().proposal?.id;
    set({ items: previousItems.filter(i => String(i.id) !== String(itemId)) });

    try {
      await removeItem(itemId);
    } catch (err) {
      console.warn('Supabase sync failed for item remove, preserving change in offline draft:', err);
      try {
        const norm = { ...get().proposal, items: get().items };
        if (pid) localStorage.setItem(`voyanta_proposal_${pid}`, JSON.stringify(norm));
      } catch {}
    }
  },

  updateItemOptimistic: async (itemId, patch) => {
    const previousItems = [...get().items];
    const pid = get().proposal?.id;
    set({ items: previousItems.map(i => String(i.id) === String(itemId) ? { ...i, ...patch } : i) });

    try {
      const updated = await updateItem(itemId, patch);
      set((state) => ({
        items: state.items.map(i => {
          if (String(i.id) === String(itemId)) {
            return { ...updated, ...i };
          }
          return i;
        })
      }));
    } catch (err) {
      console.warn('Supabase sync failed for item update, preserving change in offline draft:', err);
      try {
        const norm = { ...get().proposal, items: get().items };
        if (pid) localStorage.setItem(`voyanta_proposal_${pid}`, JSON.stringify(norm));
      } catch {}
    }
  },

  /* ── Vault-to-Day insertion actions ────────────────────────────── */

  addVaultHotelToDay: (dayNumber, hotel) => set((state) => {
    if (!state.proposal?.days) return state;
    const nextDays = state.proposal.days.map((d) => {
      if (d.day_number !== dayNumber) return d;
      const exists = d.hotels?.some((h) => h.id === hotel.id);
      if (exists) return d;
      return {
        ...d,
        hotels: [
          ...(d.hotels || []),
          {
            id: hotel.id,
            name: hotel.name,
            category: hotel.category || '4 Star',
            meal_plan: hotel.meal_type || 'CP (Breakfast)',
            price_per_night: hotel.price_per_night || 0,
            location: hotel.location || '',
            image_url: hotel.image_url,
          },
        ],
        day_total: (d.day_total || 0) + (hotel.price_per_night || 0),
      };
    });
    const nextProposal = { ...state.proposal, days: nextDays };
    saveLocalBackup({ ...state, proposal: nextProposal });
    return { proposal: nextProposal };
  }),

  addVaultActivityToDay: (dayNumber, activity) => set((state) => {
    if (!state.proposal?.days) return state;
    const travelers = Math.max(1, (state.client?.num_adults || 0) + (state.client?.num_children || 0));
    const nextDays = state.proposal.days.map((d) => {
      if (d.day_number !== dayNumber) return d;
      const exists = d.activities?.some((a) => a.id === activity.id);
      if (exists) return d;
      return {
        ...d,
        activities: [
          ...(d.activities || []),
          {
            id: activity.id,
            name: activity.name,
            duration: activity.duration_hours ? `${activity.duration_hours} hrs` : '3 hrs',
            timing: activity.timing || '10:00 AM',
            price: activity.price || 0,
            location: activity.location || '',
            description: activity.description || '',
          },
        ],
        day_total: (d.day_total || 0) + ((activity.price || 0) * travelers),
      };
    });
    const nextProposal = { ...state.proposal, days: nextDays };
    saveLocalBackup({ ...state, proposal: nextProposal });
    return { proposal: nextProposal };
  }),

  addVaultFlightToDay: (dayNumber, flight) => set((state) => {
    if (!state.proposal?.days) return state;
    const travelers = Math.max(1, (state.client?.num_adults || 0) + (state.client?.num_children || 0));
    const nextDays = state.proposal.days.map((d) => {
      if (d.day_number !== dayNumber) return d;
      const exists = d.flights?.some((f) => f.id === flight.id);
      if (exists) return d;
      return {
        ...d,
        flights: [
          ...(d.flights || []),
          {
            id: flight.id,
            airline: flight.airline,
            flight_no: flight.flight_no || 'TBD',
            origin: flight.origin || '',
            destination: flight.destination || '',
            cost: flight.cost || 0,
            class: flight.class_ || 'Economy',
          },
        ],
        day_total: (d.day_total || 0) + ((flight.cost || 0) * travelers),
      };
    });
    const nextProposal = { ...state.proposal, days: nextDays };
    saveLocalBackup({ ...state, proposal: nextProposal });
    return { proposal: nextProposal };
  }),

  setField: (field, value) => set((state) => ({
    client: { ...state.client, [field]: value },
    proposal: state.proposal ? { ...state.proposal, [field]: value } : state.proposal
  })),

  addRecommendationOption: (opt) => set((state) => ({
    recommendationOptions: [opt, ...(state.recommendationOptions || []).filter(o => (o.option_id || o.id) !== (opt.option_id || opt.id))]
  })),

  deleteRecommendationOption: (id) => set((state) => ({
    recommendationOptions: (state.recommendationOptions || []).filter(o => (o.option_id || o.id) !== id)
  }))
}));

export default useProposalStore;
