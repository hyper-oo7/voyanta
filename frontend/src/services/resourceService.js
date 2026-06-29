import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

// Generic CRUD for the four resource tables. Always returns {data, error}-free.
// Records keep their original supplier columns inside `raw` (jsonb).

const listCache = new Map();

export function makeResourceService(resource) {
  return {
    list: async (filters = {}, force = false) => {
      if (!supabase) return [];
      const cacheKey = `${resource}:${JSON.stringify(filters)}`;
      if (!force && listCache.has(cacheKey)) return listCache.get(cacheKey);

      let q = supabase.from(resource).select('*').order('created_at', { ascending: false });
      // Optional simple filters: { agency_id, supplier, etc. }
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
      const { data, error } = await q;
      if (error) throw error;
      
      const result = data || [];
      listCache.set(cacheKey, result);
      return result;
    },
    get: async (id) => {
      const { data, error } = await supabase.from(resource).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (row) => {
      listCache.clear();
      const { data, error } = await supabase.from(resource).insert({ agency_id: DEFAULT_AGENCY_ID, ...row }).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id, patch) => {
      listCache.clear();
      const { data, error } = await supabase.from(resource).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    remove: async (id) => {
      listCache.clear();
      const { error } = await supabase.from(resource).delete().eq('id', id);
      if (error) throw error;
    },
    removeMany: async (ids) => {
      if (!ids?.length) return;
      listCache.clear();
      const { error } = await supabase.from(resource).delete().in('id', ids);
      if (error) throw error;
    },
  };
}

export const hotelsService     = makeResourceService('hotels');
export const flightsService    = makeResourceService('flights');
export const activitiesService = makeResourceService('activities');
export const templatesService  = makeResourceService('templates');

export const itinerariesService = makeResourceService('itineraries');

// Custom service for itinerary_blocks to omit agency_id insertion (since it's not in the DB schema)
export const itineraryBlocksService = {
  ...makeResourceService('itinerary_blocks'),
  create: async (row) => {
    const { data, error } = await supabase.from('itinerary_blocks').insert({ ...row }).select().single();
    if (error) throw error;
    return data;
  }
};

const DEFAULT_SETTINGS = {
  agency_name: 'Voyanta Demo Agency',
  logo_url: '',
  address: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  gst_number: '',
  default_currency: 'INR',
  default_proposal_validity: 30,
  theme_preferences: 'light',
  notification_preferences: {
    proposal_accepted: true,
    proposal_declined: true,
    flight_updates: false,
    weekly_digest: true
  },
  social_facebook: '',
  social_instagram: '',
  social_linkedin: '',
  font_family: '',
  primary_color: '#0b1c30'
};

export const settingsService = {
  get: async () => {
    if (!supabase) return DEFAULT_SETTINGS;
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .maybeSingle();

      if (error) throw error;
      
      // If it doesn't exist, try loading from agencies as fallback, and create the row
      if (!data) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', DEFAULT_AGENCY_ID)
          .maybeSingle();

        const initial = { ...DEFAULT_SETTINGS };
        if (agencyData) {
          initial.agency_name = agencyData.name || initial.agency_name;
          initial.logo_url = agencyData.logo_url || initial.logo_url;
          initial.primary_color = agencyData.primary_color || initial.primary_color;
        }

        // Create the settings row
        const { data: created } = await supabase
          .from('templates')
          .insert({
            agency_id: DEFAULT_AGENCY_ID,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: initial
          })
          .select()
          .single();

        return created ? { ...initial, ...created.data } : initial;
      }

      return { ...DEFAULT_SETTINGS, ...data.data };
    } catch (e) {
      console.error('Failed to load settings:', e);
      return DEFAULT_SETTINGS;
    }
  },
  update: async (settings) => {
    if (!supabase) return settings;
    try {
      // 1. Try to update agencies table for standard fields so other parts can query it
      const agencyPatch = {
        name: settings.agency_name,
        logo_url: settings.logo_url || null,
        primary_color: settings.primary_color || null,
      };
      await supabase.from('agencies').update(agencyPatch).eq('id', DEFAULT_AGENCY_ID);

      // 2. Fetch the AgencySettings template row
      const { data: existing } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('templates')
          .update({ data: settings })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        cache.set('settings', data.data);
        return data.data;
      } else {
        const { data, error } = await supabase
          .from('templates')
          .insert({
            agency_id: DEFAULT_AGENCY_ID,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: settings
          })
          .select()
          .single();
        if (error) throw error;
        return data.data;
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
      throw e;
    }
  }
};


