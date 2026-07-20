import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.js';
import { logger } from '../utils/logger.js';

const BackendHealthContext = createContext({
  isHealthy: true,
  checkHealth: async () => false,
  lastChecked: null,
});

export function BackendHealthProvider({ children }) {
  const [isHealthy, setIsHealthy] = useState(true); // Assume healthy initially
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      // Use raw fetch — NOT api.get() — to avoid false OFFLINE reports.
      // api.get() calls supabase.auth.getSession() which can throw during
      // session refresh, causing the health endpoint to appear unreachable.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      const healthy = res.ok && (data.status === 'ok' || res.ok);
      setIsHealthy(healthy);
      setLastChecked(new Date());
      return healthy;
    } catch (err) {
      logger.error('Backend health check failed:', err);
      setIsHealthy(false);
      setLastChecked(new Date());
      return false;
    }
  }, []);

  useEffect(() => {
    // Check health once on startup
    checkHealth();

    // In dev mode, check periodically every 15s if it's down, to auto-recover
    if (import.meta.env.MODE === 'development') {
      const intervalId = setInterval(() => {
        checkHealth();
      }, 15000);
      return () => clearInterval(intervalId);
    }
  }, [checkHealth]);

  return (
    <BackendHealthContext.Provider value={{ isHealthy, checkHealth, lastChecked }}>
      {children}
    </BackendHealthContext.Provider>
  );
}

export function useBackendHealth() {
  return useContext(BackendHealthContext);
}
