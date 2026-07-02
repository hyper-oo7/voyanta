import { createContext, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuthStore } from '../store/authStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, isLoading: loading, setUser, setLoading, clearAuth, setAgencyId } = useAuthStore();

  // Look up the user's agency_id from the public.users table
  const resolveAgencyId = useCallback(async (authUser) => {
    if (!authUser || !supabase) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('agency_id')
        .eq('id', authUser.id)
        .maybeSingle();
      if (data?.agency_id) {
        setAgencyId(data.agency_id);
      }
    } catch (e) {
      console.warn('Failed to resolve agency_id:', e);
    }
  }, [setAgencyId]);

  // Restore session (Supabase or demo) on mount
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;
      setUser(authUser, session);
      if (authUser) await resolveAgencyId(authUser);
      setLoading(false);
      
      const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser, session);
        if (newUser) await resolveAgencyId(newUser);
      });
      if (sub?.subscription) unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub();
  }, [setUser, setLoading, resolveAgencyId]);

  const signUp = useCallback(async ({ email, password, fullName }) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Resolve agency after sign in
    if (data?.user) await resolveAgencyId(data.user);
    return data;
  }, [resolveAgencyId]);

  const signOut = useCallback(async () => {
    clearAuth();
    if (supabase) await supabase.auth.signOut();
  }, [clearAuth]);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error('Supabase not configured');
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const signInWithProvider = useCallback(async (provider) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
