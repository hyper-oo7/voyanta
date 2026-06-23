import { createClient } from '@supabase/supabase-js';

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

export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || 'false') === 'true';

export const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000001';

// In-memory demo user (no Supabase auth call needed)
export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@voyanta.app',
  user_metadata: { full_name: 'Demo User' },
  isDemo: true,
};
