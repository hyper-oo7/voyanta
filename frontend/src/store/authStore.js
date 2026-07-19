import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient.js';

export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  session: null,
  agencyId: null,
  isDemo: false,
  isLoading: true,
  hasAcceptedTerms: false,

  // Setters
  setUser: (user, session = null, isDemo = false) => set({ user, session, isDemo }),
  setAgencyId: (agencyId) => set({ agencyId }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, agencyId: null, isDemo: false, hasAcceptedTerms: false }),

  // Helpers
  getAgencyId: () => {
    if (get().isDemo) {
      return '00000000-0000-0000-0000-000000000001';
    }
    const aid = get().agencyId;
    if (aid && aid !== 'null' && aid !== 'undefined') return aid;
    return '00000000-0000-0000-0000-000000000001';
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
        if (supabase?.rest) supabase.rest.headers['x-tenant-id'] = data.agency_id;
      } else {
        let aid = null;
        const { data: agData } = await supabase.from('agencies').select('id').eq('contact_email', authUser.email).maybeSingle();
        if (agData?.id) {
          aid = agData.id;
        } else {
          aid = localStorage.getItem('voyanta_fallback_agency_id') || '00000000-0000-0000-0000-000000000001';
        }
        if (aid) {
          set({ agencyId: aid });
          if (supabase?.rest) supabase.rest.headers['x-tenant-id'] = aid;
          await supabase.from('users').upsert({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
            agency_id: aid,
            role: 'owner'
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to resolve agency_id:', e);
    }
  },

  checkTermsAcceptance: async () => {
    const { user, isDemo } = get();
    if (!user || isDemo || !supabase) {
      set({ hasAcceptedTerms: true });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_terms_acceptances')
        .select('id')
        .eq('user_id', user.id)
        .eq('terms_version', 'v1.0')
        .maybeSingle();

      if (error) throw error;
      set({ hasAcceptedTerms: !!data });
    } catch (e) {
      console.warn('Failed to check terms acceptance:', e);
      // In case of error (e.g. database loading), default to false to trigger modal for safety
      set({ hasAcceptedTerms: false });
    }
  },

  acceptTerms: async (userAgent) => {
    const { user, isDemo } = get();
    if (!user || isDemo || !supabase) return;
    try {
      const { error } = await supabase
        .from('user_terms_acceptances')
        .insert({
          user_id: user.id,
          terms_version: 'v1.0',
          user_agent: userAgent || navigator.userAgent,
        });

      if (error) throw error;
      set({ hasAcceptedTerms: true });
    } catch (e) {
      console.error('Failed to log terms acceptance:', e);
      throw e;
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
        await get().checkTermsAcceptance();
      }
      set({ isLoading: false });

      const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
        const newUser = session?.user ?? null;
        if (newUser) {
          set({ isDemo: false });
          get().setUser(newUser, session, false);
          await get().resolveAgencyId(newUser);
          await get().checkTermsAcceptance();
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
    
    // Auto-accept terms upon creation if user object returned immediately
    if (data?.user) {
      try {
        await supabase.from('user_terms_acceptances').insert({
          user_id: data.user.id,
          terms_version: 'v1.0',
          user_agent: navigator.userAgent,
        });
        set({ hasAcceptedTerms: true });
      } catch (e) {
        console.warn('Failed auto-terms insert on signup:', e);
      }
    }
    return data;
  },

  signIn: async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase not configured');
    set({ isDemo: false });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
      await get().resolveAgencyId(data.user);
      await get().checkTermsAcceptance();
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

// Automatically update PostgREST headers when agencyId changes in Zustand store to inject into Postgres session context
if (supabase) {
  useAuthStore.subscribe((state) => {
    if (supabase.rest) {
      const aid = state.agencyId || (state.isDemo ? '00000000-0000-0000-0000-000000000001' : null);
      if (aid && aid !== 'null' && aid !== 'undefined') {
        supabase.rest.headers['x-tenant-id'] = aid;
      } else if (state.isDemo) {
        supabase.rest.headers['x-tenant-id'] = '00000000-0000-0000-0000-000000000001';
      } else {
        delete supabase.rest.headers['x-tenant-id'];
      }
    }
  });
}

