import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  isLoading: true,
  
  setUser: (user, session = null) => set({ user, session }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null })
}));
