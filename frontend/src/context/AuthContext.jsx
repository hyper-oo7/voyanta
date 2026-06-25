import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, DEMO_MODE, DEMO_USER } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

const DEMO_KEY = 'voyanta_demo_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Restore session (Supabase or demo) on mount
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      // Demo session restore
      if (localStorage.getItem(DEMO_KEY) === '1') {
        setUser(DEMO_USER);
        setIsDemo(true);
        setLoading(false);
        return;
      }
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub();
  }, []);

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
    localStorage.removeItem(DEMO_KEY);
    setIsDemo(false);
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

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

  const enterDemoMode = useCallback(() => {
    localStorage.setItem(DEMO_KEY, '1');
    setUser(DEMO_USER);
    setIsDemo(true);
  }, []);

  const value = {
    user,
    loading,
    isDemo,
    demoEnabled: DEMO_MODE,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
    enterDemoMode,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
