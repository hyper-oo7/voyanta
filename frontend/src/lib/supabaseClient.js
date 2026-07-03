import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/authStore.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (url && key)
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const isSupabaseConfigured = () => Boolean(supabase);

// Fallback agency ID for demo/dev when no user is logged in
export const DEMO_AGENCY_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_AGENCY_ID = DEMO_AGENCY_ID;

// Dynamic agency ID — resolves from auth store, falls back to demo
export function getAgencyId() {
  try {
    return useAuthStore.getState().getAgencyId();
  } catch {
    return DEMO_AGENCY_ID;
  }
}
