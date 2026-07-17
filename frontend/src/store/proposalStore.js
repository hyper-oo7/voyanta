import { create } from 'zustand';
import { fetchProposalById, updateProposal, createProposal } from '../services/proposalService.js';
import { listItems, addItem, removeItem, updateItem } from '../services/proposalItemService.js';
import { DEFAULT_COUNTRY } from '../lib/countries.js';
import { sanitizeBrandingObject } from '../services/resourceService.js';

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

export const useProposalStore = create((set, get) => ({
  // State
  activeId: localStorage.getItem('voyanta_active_proposal_id') || null,
  proposal: null,
  items: [],
  recommendationOptions: [],
  client: {
    customer_name: '', phone: '', country: DEFAULT_COUNTRY, email: '',
    destination: '',
    date_mode: 'dates',
    start_date: '', end_date: '',
    duration_days: 1, duration_nights: 1,
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
    pct_markup: 0,
    discount: 0,
    tax: 0
  },
  status: 'idle', // 'idle' | 'loading' | 'saving' | 'error'

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

  // Load a proposal from the DB
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
        
        // Fallback to global settings if branding fields are missing/empty
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
            date_mode: b.date_mode || 'dates',
            duration_days: b.duration_days || 1,
            duration_nights: b.duration_nights || 1,
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

  // Build the DB payload from current state
  buildPayload: () => {
    const { client: c, branding, costingPrefs, proposal } = get();
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

  // Save draft background sync
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

  // Optimistic Background Syncs for Items
  addItemsOptimistic: async (newItemsToInsert) => {
    const previousItems = [...get().items];
    const pid = get().proposal?.id;
    if (!pid) throw new Error('No active proposal');
    
    // 1. Optimistic UI Update with permanent UUIDs
    const optimisticItems = newItemsToInsert.map((item) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
      proposal_id: pid
    }));
    set({ items: [...previousItems, ...optimisticItems] });

    // 2. Background Database Sync without overwriting live user typing
    try {
      const addedResults = await Promise.all(optimisticItems.map((item) => addItem(pid, item)));
      set((state) => ({
        items: state.items.map((it) => {
          const matched = addedResults.find((r) => r && String(r.id) === String(it.id));
          if (matched) {
            // Merge DB metadata while strictly preserving live user edits (label, qty, unit_price)
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
    // Optimistic remove
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
    // Optimistic patch
    set({ items: previousItems.map(i => String(i.id) === String(itemId) ? { ...i, ...patch } : i) });

    try {
      const updated = await updateItem(itemId, patch);
      set((state) => ({
        items: state.items.map(i => {
          if (String(i.id) === String(itemId)) {
            // Merge DB response while preserving live user edits in current state
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
