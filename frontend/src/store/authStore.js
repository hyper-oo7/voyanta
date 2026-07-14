import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient.js';

export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  session: null,
  agencyId: null,
  isDemo: false,
  isLoading: true,

  // Setters
  setUser: (user, session = null, isDemo = false) => set({ user, session, isDemo }),
  setAgencyId: (agencyId) => set({ agencyId }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, agencyId: null, isDemo: false }),

  // Helpers
  getAgencyId: () => {
    if (get().isDemo) {
      return '00000000-0000-0000-0000-000000000001';
    }
    return get().agencyId || null;
  },

  resolveAgencyId: async (authUser) => {
    if (!authUser || !supabase) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('agency_id')
        .eq('id', authUser.id)
        .maybeSingle();
      if (data?.agency_id) {
        set({ agencyId: data.agency_id });
      }
    } catch (e) {
      console.warn('Failed to resolve agency_id:', e);
    }
  },

  // Auth Operations
  initAuth: () => {
    if (!supabase) {
      set({ isLoading: false });
      return () => {};
    }

    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;
      if (authUser) {
        set({ isDemo: false });
        get().setUser(authUser, session, false);
        await get().resolveAgencyId(authUser);
      }
      set({ isLoading: false });

      const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
        const newUser = session?.user ?? null;
        if (newUser) {
          set({ isDemo: false });
          get().setUser(newUser, session, false);
          await get().resolveAgencyId(newUser);
        }
      });
      if (sub?.subscription) {
        unsub = () => sub.subscription.unsubscribe();
      }
    })();

    return () => unsub();
  },

  signUp: async ({ email, password, fullName }) => {
    if (!supabase) throw new Error('Supabase not configured');
    set({ isDemo: false });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  },

  signIn: async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase not configured');
    set({ isDemo: false });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
      await get().resolveAgencyId(data.user);
    }
    return data;
  },

  signInWithProvider: async (provider) => {
    if (!supabase) throw new Error('Supabase not configured');
    set({ isDemo: false });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    get().clearAuth();
    if (supabase) await supabase.auth.signOut();
  },

  resetPassword: async (email) => {
    if (!supabase) throw new Error('Supabase not configured');
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },
}));
