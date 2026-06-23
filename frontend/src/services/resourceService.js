import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

// Generic CRUD for the four resource tables. Always returns {data, error}-free.
// Records keep their original supplier columns inside `raw` (jsonb).

export function makeResourceService(resource) {
  return {
    list: async (filters = {}) => {
      if (!supabase) return [];
      let q = supabase.from(resource).select('*').order('created_at', { ascending: false });
      // Optional simple filters: { agency_id, supplier, etc. }
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    get: async (id) => {
      const { data, error } = await supabase.from(resource).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (row) => {
      const { data, error } = await supabase.from(resource).insert({ agency_id: DEFAULT_AGENCY_ID, ...row }).select().single();
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
