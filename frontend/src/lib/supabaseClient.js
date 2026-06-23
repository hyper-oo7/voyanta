// Supabase client — initialised lazily so the app runs without env vars during
// the Stitch-port phase. To activate:
//   1. yarn add @supabase/supabase-js
//   2. Set in /app/frontend/.env:
//        VITE_SUPABASE_URL=...
//        VITE_SUPABASE_ANON_KEY=...
//   3. Services in /src/services/* will switch from mocks to Supabase automatically.

let _client = null;
let _attempted = false;

export async function getSupabase() {
  if (_client) return _client;
  if (_attempted) return null;
  _attempted = true;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    // Build the module specifier at runtime so Vite's static analyzer doesn't
    // try to resolve it during dev. This keeps @supabase/supabase-js optional.
    const pkg = ['@supabase', 'supabase-js'].join('/');
    const mod = await import(/* @vite-ignore */ pkg);
    _client = mod.createClient(url, key);
    return _client;
  } catch (e) {
    console.warn('[supabase] not available yet:', e?.message);
    return null;
  }
}

export const isSupabaseConfigured = () =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
