import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  agencyId: null,
  isLoading: true,
  
  setUser: (user, session = null) => set({ user, session }),
  setAgencyId: (agencyId) => set({ agencyId }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, agencyId: null }),

  // Resolved agency ID: from DB lookup → fallback to demo
  getAgencyId: () => {
    return get().agencyId || '00000000-0000-0000-0000-000000000001';
  },
}));
