import { createContext, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuthStore } from '../store/authStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, isLoading: loading, setUser, setLoading, clearAuth } = useAuthStore();

  // Restore session (Supabase or demo) on mount
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null, session);
      setLoading(false);
      
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null, session);
      });
      if (sub?.subscription) unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub();
  }, [setUser, setLoading]);

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
    return data;
  }, []);

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

