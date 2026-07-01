import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

// Generic CRUD for the four resource tables. Always returns {data, error}-free.
// Records keep their original supplier columns inside `raw` (jsonb).

const listCache = new Map();

export function makeResourceService(resource) {
  return {
    list: async (filters = {}, force = false) => {
      const cacheKey = `${resource}:${JSON.stringify(filters)}`;
      const localKey = `voyanta_res_cache_${cacheKey}`;
      if (!force && listCache.has(cacheKey)) return listCache.get(cacheKey);

      if (!supabase) {
        try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
      }

      let q = supabase.from(resource).select('*').order('created_at', { ascending: false });
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
      const { data, error } = await q;
      if (error) {
        try {
          const cached = JSON.parse(localStorage.getItem(localKey) || 'null');
          if (cached) return cached;
        } catch {}
        throw error;
      }
      
      const result = data || [];
      listCache.set(cacheKey, result);
      try { localStorage.setItem(localKey, JSON.stringify(result)); } catch {}
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

export const itineraryBlocksService = makeResourceService('itinerary_blocks');

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

export function sanitizeBrandingObject(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const cleaned = {};
  for (const k in raw) {
    const val = raw[k];
    if (k === 'notification_preferences' || k === 'custom_blocks' || k === 'itinerary' || k === 'preferences' || k === 'computed_totals' || k === 'items' || typeof val === 'boolean' || typeof val === 'number') {
      cleaned[k] = val;
      continue;
    }
    if (Array.isArray(val)) {
      cleaned[k] = val.map(item => typeof item === 'object' && item !== null ? (item.url || item.src || item.text || item.label || JSON.stringify(item)) : String(item ?? '')).join('\n');
    } else if (val && typeof val === 'object') {
      cleaned[k] = String(val.url || val.src || val.image_url || val.text || val.content || val.label || JSON.stringify(val) || '');
    } else {
      cleaned[k] = val ?? '';
    }
  }
  return cleaned;
}

export const settingsService = {
  get: async () => {
    if (!supabase) return sanitizeBrandingObject(DEFAULT_SETTINGS);
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .limit(1);

      if (error) throw error;
      
      const row = data && data.length > 0 ? data[0] : null;

      // If it doesn't exist, try loading from agencies as fallback, and create the row
      if (!row) {
        const { data: agencyRows } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', DEFAULT_AGENCY_ID)
          .limit(1);

        const agencyData = agencyRows && agencyRows.length > 0 ? agencyRows[0] : null;
        const initial = { ...DEFAULT_SETTINGS };
        if (agencyData) {
          initial.agency_name = agencyData.name || initial.agency_name;
          initial.logo_url = agencyData.logo_url || initial.logo_url;
          initial.primary_color = agencyData.primary_color || initial.primary_color;
        }

        const sanitizedInitial = sanitizeBrandingObject(initial);

        // Create the settings row
        const { data: createdRows } = await supabase
          .from('templates')
          .insert({
            agency_id: DEFAULT_AGENCY_ID,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: sanitizedInitial
          })
          .select()
          .limit(1);

        const created = createdRows && createdRows.length > 0 ? createdRows[0] : null;
        return created ? sanitizeBrandingObject({ ...sanitizedInitial, ...created.data }) : sanitizedInitial;
      }

      return sanitizeBrandingObject({ ...DEFAULT_SETTINGS, ...row.data });
    } catch (e) {
      console.error('Failed to load settings:', e);
      return sanitizeBrandingObject(DEFAULT_SETTINGS);
    }
  },
  update: async (settings) => {
    const cleanSettings = sanitizeBrandingObject(settings);
    if (!supabase) return cleanSettings;
    try {
      // 1. Try to update agencies table for standard fields so other parts can query it
      const agencyPatch = {
        name: cleanSettings.agency_name,
        logo_url: cleanSettings.logo_url || null,
        primary_color: cleanSettings.primary_color || null,
      };
      await supabase.from('agencies').update(agencyPatch).eq('id', DEFAULT_AGENCY_ID);

      // 2. Fetch the AgencySettings template row using limit(1) to avoid duplicate row errors
      const { data: existingRows } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .limit(1);

      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existing) {
        const { data: updatedRows, error } = await supabase
          .from('templates')
          .update({ data: cleanSettings })
          .eq('id', existing.id)
          .select()
          .limit(1);
        if (error) throw error;
        const updated = updatedRows && updatedRows.length > 0 ? updatedRows[0] : null;
        if (updated) cache.set('settings', updated.data);
        return updated ? sanitizeBrandingObject(updated.data) : cleanSettings;
      } else {
        const { data: insertedRows, error } = await supabase
          .from('templates')
          .insert({
            agency_id: DEFAULT_AGENCY_ID,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: cleanSettings
          })
          .select()
          .limit(1);
        if (error) throw error;
        const inserted = insertedRows && insertedRows.length > 0 ? insertedRows[0] : null;
        if (inserted) cache.set('settings', inserted.data);
        return inserted ? sanitizeBrandingObject(inserted.data) : cleanSettings;
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
      throw e;
    }
  }
};


