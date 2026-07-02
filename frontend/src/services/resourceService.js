import { supabase, getAgencyId } from '../lib/supabaseClient.js';

// Generic CRUD for resource tables with pagination support.
// Records keep their original supplier columns inside `raw` (jsonb).

const DEFAULT_PAGE_SIZE = 100;

export function makeResourceService(resource) {
  return {
    list: async (filters = {}, force = false, { page = 0, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
      const localKey = `voyanta_res_cache_${resource}:${JSON.stringify(filters)}`;

      if (!supabase) {
        try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase.from(resource).select('*', { count: 'exact' }).order('created_at', { ascending: false });
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) {
        try {
          const cached = JSON.parse(localStorage.getItem(localKey) || 'null');
          if (cached) return cached;
        } catch {}
        throw error;
      }
      
      const result = data || [];
      try { localStorage.setItem(localKey, JSON.stringify(result)); } catch {}
      return result;
    },
    count: async (filters = {}) => {
      if (!supabase) return 0;
      let q = supabase.from(resource).select('id', { count: 'exact', head: true });
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
      const { count, error } = await q;
      if (error) return 0;
      return count || 0;
    },
    get: async (id) => {
      const { data, error } = await supabase.from(resource).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (row) => {
      const agencyId = getAgencyId();
      const { data, error } = await supabase.from(resource).insert({ agency_id: agencyId, ...row }).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id, patch) => {
      const { data, error } = await supabase.from(resource).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    remove: async (id) => {
      const { error } = await supabase.from(resource).delete().eq('id', id);
      if (error) throw error;
    },
    removeMany: async (ids) => {
      if (!ids?.length) return;
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
    const agencyId = getAgencyId();
    const cacheKey = `voyanta_settings_cache_${agencyId}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch {}
    if (!supabase) return sanitizeBrandingObject(cached || DEFAULT_SETTINGS);
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .eq('agency_id', agencyId)
        .limit(1);

      if (error) throw error;
      
      const row = data && data.length > 0 ? data[0] : null;

      if (!row) {
        const { data: agencyRows } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', agencyId)
          .limit(1);

        const agencyData = agencyRows && agencyRows.length > 0 ? agencyRows[0] : null;
        const initial = { ...(cached || DEFAULT_SETTINGS) };
        if (agencyData) {
          initial.agency_name = agencyData.name || initial.agency_name;
          initial.logo_url = agencyData.logo_url || initial.logo_url;
          initial.primary_color = agencyData.primary_color || initial.primary_color;
        }

        const sanitizedInitial = sanitizeBrandingObject(initial);
        try { localStorage.setItem(cacheKey, JSON.stringify(sanitizedInitial)); } catch {}

        const { data: createdRows } = await supabase
          .from('templates')
          .insert({
            agency_id: agencyId,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: sanitizedInitial
          })
          .select()
          .limit(1);

        const created = createdRows && createdRows.length > 0 ? createdRows[0] : null;
        const finalRes = created ? sanitizeBrandingObject({ ...sanitizedInitial, ...created.data }) : sanitizedInitial;
        try { localStorage.setItem(cacheKey, JSON.stringify(finalRes)); } catch {}
        return finalRes;
      }

      const finalRes = sanitizeBrandingObject({ ...DEFAULT_SETTINGS, ...row.data });
      try { localStorage.setItem(cacheKey, JSON.stringify(finalRes)); } catch {}
      return finalRes;
    } catch (e) {
      console.error('Failed to load settings:', e);
      return sanitizeBrandingObject(cached || DEFAULT_SETTINGS);
    }
  },
  update: async (settings) => {
    const agencyId = getAgencyId();
    const cacheKey = `voyanta_settings_cache_${agencyId}`;
    const cleanSettings = sanitizeBrandingObject(settings);
    try { localStorage.setItem(cacheKey, JSON.stringify(cleanSettings)); } catch {}
    if (!supabase) return cleanSettings;
    try {
      const agencyPatch = {
        name: cleanSettings.agency_name,
        logo_url: cleanSettings.logo_url || null,
        primary_color: cleanSettings.primary_color || null,
      };
      await supabase.from('agencies').update(agencyPatch).eq('id', agencyId);

      const { data: existingRows } = await supabase
        .from('templates')
        .select('*')
        .eq('category', 'AgencySettings')
        .eq('agency_id', agencyId)
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
        const finalRes = updated ? sanitizeBrandingObject(updated.data) : cleanSettings;
        try { localStorage.setItem(cacheKey, JSON.stringify(finalRes)); } catch {}
        return finalRes;
      } else {
        const { data: insertedRows, error } = await supabase
          .from('templates')
          .insert({
            agency_id: agencyId,
            name: 'Agency Settings',
            category: 'AgencySettings',
            data: cleanSettings
          })
          .select()
          .limit(1);
        if (error) throw error;
        const inserted = insertedRows && insertedRows.length > 0 ? insertedRows[0] : null;
        const finalRes = inserted ? sanitizeBrandingObject(inserted.data) : cleanSettings;
        try { localStorage.setItem(cacheKey, JSON.stringify(finalRes)); } catch {}
        return finalRes;
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
      return cleanSettings;
    }
  }
};
