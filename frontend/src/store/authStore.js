import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  agencyId: null,
  isDemo: false,
  isLoading: true,
  
  setUser: (user, session = null, isDemo = false) => set({ user, session, isDemo }),
  setAgencyId: (agencyId) => set({ agencyId }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, agencyId: null, isDemo: false }),

  // Resolved agency ID: returns demo agency ONLY if isDemo is active, otherwise returns resolved agency ID or null
  getAgencyId: () => {
    if (get().isDemo) {
      return '00000000-0000-0000-0000-000000000001';
    }
    return get().agencyId || null;
  },
}));
