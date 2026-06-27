import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isDemo: false,
  session: null,
  isLoading: true,
  
  setUser: (user, session = null) => set({ user, session }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, isDemo: false })
}));
