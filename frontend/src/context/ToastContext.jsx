import { createContext, useCallback, useContext, useState, useEffect } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 3500);
  }, []);

  useEffect(() => {
    const handleDbError = (e) => {
      const { resource, error } = e.detail || {};
      push({ type: 'error', msg: `Database Error (${resource || 'System'}): ${error || 'Unknown error'}` });
    };
    window.addEventListener('voyanta:database-error', handleDbError);
    return () => window.removeEventListener('voyanta:database-error', handleDbError);
  }, [push]);

  const api = {
    success: (msg, opts = {}) => push({ type: 'success', msg, ...opts }),
    error: (msg, opts = {}) => push({ type: 'error', msg, ...opts }),
    info: (msg, opts = {}) => push({ type: 'info', msg, ...opts }),
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-md right-md z-[9999999] flex flex-col gap-sm pointer-events-none" data-testid="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid={`toast-${t.type}`}
            className={
              'pointer-events-auto px-lg py-md rounded-lg shadow-xl border font-label-md text-label-md min-w-[280px] max-w-[420px] transition-all animate-fade-in ' +
              (t.type === 'success' ? 'bg-white border-outline-variant text-primary' :
               t.type === 'error' ? 'bg-error-container border-error text-on-error-container' :
               'bg-surface-container-lowest border-outline-variant text-on-surface')
            }
          >
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
              </span>
              <span>{t.msg}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
