import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useBackendHealth } from '../context/BackendHealthContext.jsx';

export default function DiagnosticsPanel() {
  const { user } = useAuthStore();
  const { isHealthy, lastChecked } = useBackendHealth();
  const [open, setOpen] = useState(false);
  const [latency, setLatency] = useState(null);

  // Measure rough latency to backend
  useEffect(() => {
    if (!open) return;
    let isActive = true;
    
    const measure = async () => {
      const start = performance.now();
      try {
        await fetch('/api/health');
        if (isActive) setLatency(Math.round(performance.now() - start));
      } catch (e) {
        if (isActive) setLatency('Error');
      }
    };
    
    measure();
    const interval = setInterval(measure, 5000);
    return () => { isActive = false; clearInterval(interval); };
  }, [open]);

  if (import.meta.env.MODE !== 'development' || (typeof window !== 'undefined' && window.location.pathname.includes('/print'))) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden no-print">
      {!open ? (
        <button 
          onClick={() => setOpen(true)}
          className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ${
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
          title="Developer Diagnostics"
        >
          <span className="material-symbols-outlined text-sm">bug_report</span>
        </button>
      ) : (
        <div className="bg-surface border border-outline rounded-lg shadow-xl p-4 w-80 text-sm font-body-sm text-on-surface">
          <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-2">
            <h3 className="font-label-md text-primary font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-md">engineering</span>
              Diagnostics
            </h3>
            <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-md">close</span>
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Environment:</span>
              <span className="font-mono bg-surface-container px-2 py-0.5 rounded">{import.meta.env.MODE}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Backend (Python):</span>
              <span className={`font-mono px-2 py-0.5 rounded ${isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isHealthy ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">API Latency:</span>
              <span className="font-mono">{latency ? `${latency}ms` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Last Checked:</span>
              <span className="font-mono">{lastChecked ? lastChecked.toLocaleTimeString() : '--'}</span>
            </div>
            <div className="flex justify-between border-t border-outline-variant pt-2">
              <span className="text-on-surface-variant">Supabase Auth:</span>
              <span className={`font-mono px-2 py-0.5 rounded ${user ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {user ? 'AUTHENTICATED' : 'ANONYMOUS'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
