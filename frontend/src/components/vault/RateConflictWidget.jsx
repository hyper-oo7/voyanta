import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function RateConflictWidget() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/vault/rate-conflicts');
      if (res?.conflicts) {
        setConflicts(res.conflicts);
      }
    } catch (err) {
      console.error('[RateConflicts] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleResolve = async (hotelName, resolvedRate) => {
    try {
      const res = await api.post('/api/v1/vault/resolve-rate-conflict', {
        hotel_name: hotelName,
        resolved_rate: resolvedRate
      });
      if (res?.status === 'success') {
        toast.success(`Resolved! Set to ₹${resolvedRate.toLocaleString()}`);
        setConflicts(prev => prev.filter(c => c.hotel_name !== hotelName));
      }
    } catch (err) {
      toast.error('Failed to resolve conflict.');
      console.error(err);
    }
  };

  if (loading) return null;
  if (conflicts.length === 0) return null;

  return (
    <div className="mt-6 mb-4">
      <div className="flex items-center gap-2 mb-3 px-2">
        <span className="material-symbols-outlined text-orange-500 text-[20px]">warning</span>
        <h3 className="font-bold text-sm text-on-surface">Action Required: Rate Conflicts</h3>
        <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded text-[11px] font-bold">
          {conflicts.length} Found
        </span>
      </div>
      
      <div className="flex flex-col gap-3">
        {conflicts.map((c, idx) => (
          <div key={idx} className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <h4 className="font-bold text-on-surface text-sm m-0">{c.hotel_name}</h4>
              <p className="text-xs text-on-surface-variant m-0 mt-0.5">
                This item appears in multiple vault PDFs with differing extracted rates. Select the correct rate to normalize the Vault.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {c.variations.map((v, i) => (
                <button
                  key={i}
                  onClick={() => handleResolve(c.hotel_name, v.rate)}
                  className="px-3 py-2 bg-surface border border-outline-variant rounded-xl hover:border-orange-500 hover:bg-orange-500/10 transition-colors text-left flex flex-col min-w-[140px]"
                >
                  <span className="font-mono font-bold text-sm text-on-surface">₹{v.rate.toLocaleString()}</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full" title={v.filename}>
                    {v.filename}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
