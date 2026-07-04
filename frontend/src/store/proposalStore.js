import { create } from 'zustand';
import { fetchProposalById, updateProposal, createProposal } from '../services/proposalService.js';
import { listItems, addItem, removeItem, updateItem } from '../services/proposalItemService.js';
import { DEFAULT_COUNTRY } from '../lib/countries.js';
import { sanitizeBrandingObject } from '../services/resourceService.js';

export const useProposalStore = create((set, get) => ({
  // State
  activeId: localStorage.getItem('voyanta_active_proposal_id') || null,
  proposal: null,
  items: [],
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
  },
  branding: {
    agency_name: '', logo_url: '', address: '',
    contact_email: '', contact_phone: '', website: '',
    social_facebook: '', social_instagram: '', social_linkedin: '',
    cover_image_url: '', highlights: '',
    inclusions: '', exclusions: '', terms_of_payment: '',
    primary_color: '#0b1c30', template_style: 'classic', font_family: '',
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

  setClient: (partialClient) => set((state) => ({ 
    client: typeof partialClient === 'function' ? partialClient(state.client) : { ...state.client, ...partialClient } 
  })),

  setBranding: (partialBranding) => set((state) => ({ 
    branding: sanitizeBrandingObject(typeof partialBranding === 'function' ? partialBranding(state.branding) : { ...state.branding, ...partialBranding }) 
  })),

  setCostingPrefs: (partialCosting) => set((state) => ({ 
    costingPrefs: typeof partialCosting === 'function' ? partialCosting(state.costingPrefs) : { ...state.costingPrefs, ...partialCosting } 
  })),

  setProposal: (partialProposal) => set((state) => ({ 
    proposal: typeof partialProposal === 'function' ? partialProposal(state.proposal) : { ...state.proposal, ...partialProposal } 
  })),

  setItems: (newItems) => set((state) => ({
    items: typeof newItems === 'function' ? newItems(state.items) : newItems
  })),

  // Load a proposal from the DB
  loadProposal: async (id) => {
    if (!id) {
      if (!get().activeId) get().setActiveId(crypto.randomUUID());
      set({ proposal: null, items: [], status: 'idle' });
      return;
    }
    set({ status: 'loading' });
    try {
      const [p, its] = await Promise.all([fetchProposalById(id), listItems(id)]);
      if (p) {
        get().setActiveId(p.id);
        const b = p.brief || {};
        
        const rawBranding = { ...get().branding, ...(p.preferences?.branding || {}) };
        const cleanBranding = sanitizeBrandingObject(rawBranding);

        set({
          proposal: p,
          items: its,
          client: {
            client_id: p.client_id || b.client_id || '',
            customer_name: p.client_name || '',
            phone: b.phone || '',
            country: b.country || DEFAULT_COUNTRY,
            email: b.email || '',
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
          },
          branding: cleanBranding,
          costingPrefs: { ...get().costingPrefs, ...(p.preferences?.costing || {}) },
          status: 'idle'
        });
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
    return {
      client_id: c.client_id || c.id || proposal?.client_id || null,
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
      },
      preferences: { ...(proposal?.preferences || {}), branding, costing: costingPrefs },
      itinerary: proposal?.itinerary,
      status: proposal?.status || 'Draft',
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
  }
}));
