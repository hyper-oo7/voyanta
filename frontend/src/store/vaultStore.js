import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../services/api.js';

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

        const cacheKey = `voyanta_vault_cache_v5_${currentF.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${currentF.size}`;
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

            const response = await api.post('/api/import/process', formData);
            if (!response?.job_id) {
              throw new Error('No job_id returned from server');
            }

            let attempts = 0;
            let finalResult = null;
            while (attempts < 150) {
              const status = await api.get(`/api/import/status/${response.job_id}`);
              
              if (status?.progress) {
                set({
                  batchProgress: {
                    current: fileIndex + 1,
                    total: filesList.length,
                    currentFile: currentF.name,
                    status: `${status.progress.stage} (${status.progress.current}/${status.progress.total})`
                  }
                });
              }

              if (status?.status === 'completed') {
                finalResult = status.result;
                break;
              }
              if (status?.status === 'failed') {
                throw new Error(status.error || 'Extraction failed');
              }

              await new Promise(r => setTimeout(r, 2000));
              attempts++;
            }

            if (!finalResult) {
              throw new Error('Extraction timed out');
            }

            resultData = { data: finalResult };
            try { localStorage.setItem(cacheKey, JSON.stringify(resultData)); } catch {}

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
                delta_summary: resultData.data?.delta_summary || resultData.delta_summary,
                chunks_indexed: resultData.data?.chunks_indexed || resultData.chunks_indexed,
                vault_package_id: resultData.data?.vault_package_id || resultData.vault_package_id
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
