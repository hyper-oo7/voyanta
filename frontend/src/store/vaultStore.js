import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient.js';

export const useVaultStore = create((set, get) => ({
  isProcessing: false,
  batchProgress: { current: 0, total: 0, currentFile: '', status: '' },
  metrics: null,
  reviewBatch: [],
  isReviewOpen: false,

  setIsReviewOpen: (isOpen) => set({ isReviewOpen: isOpen }),
  setReviewBatch: (batch) => set({ reviewBatch: batch }),
  resetProgress: () => set({ isProcessing: false, batchProgress: { current: 0, total: 0, currentFile: '', status: '' } }),

  startBatchProcessing: async (filesList, toast) => {
    if (filesList.length === 0) return;
    
    set({
      isProcessing: true,
      metrics: null,
      batchProgress: { current: 0, total: filesList.length, currentFile: filesList[0].name, status: 'Starting...' }
    });

    let token = null;
    try {
      await supabase?.auth?.refreshSession?.();
      const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
      token = session?.access_token || null;
    } catch (authErr) {
      console.warn('[VaultStore] Session refresh check warning:', authErr);
    }

    const extractedBatch = [];
    let cacheHitsCount = 0;
    const concurrency = 3;

    for (let i = 0; i < filesList.length; i += concurrency) {
      const chunk = filesList.slice(i, i + concurrency);
      await Promise.all(chunk.map(async (currentF, chunkIdx) => {
        const fileIndex = i + chunkIdx;
        set({
          batchProgress: {
            current: fileIndex + 1,
            total: filesList.length,
            currentFile: currentF.name,
            status: `Extracting data from ${currentF.name} (${fileIndex + 1}/${filesList.length})...`
          }
        });

        const cacheKey = `voyanta_vault_cache_v3_${currentF.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${currentF.size}`;
        let resultData = null;
        try {
          const cachedStr = localStorage.getItem(cacheKey);
          if (cachedStr) {
            resultData = JSON.parse(cachedStr);
            resultData.cache_hit = true;
            cacheHitsCount++;
          }
        } catch {}

        if (!resultData) {
          try {
            const formData = new FormData();
            formData.append('file', currentF);
            formData.append('preview_only', 'true');
            formData.append('currency', 'INR');

            const reqHeaders = {};
            if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

            let response = await fetch('/api/import/process', {
              method: 'POST',
              headers: reqHeaders,
              body: formData,
            });

            // Retry without token if auth error occurs
            if ((response.status === 401 || response.status === 403) && token) {
              const retryFormData = new FormData();
              retryFormData.append('file', currentF);
              retryFormData.append('preview_only', 'true');
              retryFormData.append('currency', 'INR');
              response = await fetch('/api/import/process', { method: 'POST', body: retryFormData });
            }

            if (response.ok) {
              resultData = await response.json();
              try { localStorage.setItem(cacheKey, JSON.stringify(resultData)); } catch {}
            } else {
              let errText = response.statusText;
              try {
                const errJson = await response.json();
                errText = errJson.detail || errJson.message || errText;
              } catch {}
              toast.error(`Error processing ${currentF.name}: ${errText}`);
              return;
            }
          } catch (err) {
            toast.error(`Failed to process ${currentF.name}: ${err.message}`);
            return;
          }
        }

        if (resultData?.data) {
          extractedBatch.push(resultData.data);
          if (fileIndex === filesList.length - 1) {
            set({
              metrics: {
                compression: resultData.compression_metrics,
                cost: cacheHitsCount === filesList.length ? '$0.00 (100% Cache Hits)' : 'Optimized via Faithful Extraction',
                cacheHit: cacheHitsCount > 0,
              }
            });
          }
        }
      }));
    }

    set({ isProcessing: false });

    if (extractedBatch.length > 0) {
      set({
        reviewBatch: extractedBatch,
        isReviewOpen: true,
      });
      // Dispatch after microtask so MyVaultPage guard sees isReviewOpen=true before event fires
      Promise.resolve().then(() => window.dispatchEvent(new CustomEvent('voyanta:vault-updated')));
    } else {
      toast.error('No files were successfully extracted. Check file formats and try again.');
    }
  }
}));
