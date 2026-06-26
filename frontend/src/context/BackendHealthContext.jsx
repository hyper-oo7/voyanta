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
      const res = await api.get('/api/health', { timeout: 5000 });
      const healthy = res && res.status === 'ok';
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

    // In dev mode, check periodically every 60s if it's down, to auto-recover
    if (import.meta.env.MODE === 'development') {
      const intervalId = setInterval(() => {
        checkHealth();
      }, 60000);
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
