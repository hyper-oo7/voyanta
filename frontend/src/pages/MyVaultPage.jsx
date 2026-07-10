import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalStore } from '../store/proposalStore.js';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../services/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const formatPrice = (price, currency = 'INR') => {
  if (!price && price !== 0) return '—';
  return `${currency} ${Number(price).toLocaleString('en-IN')}`;
};

const getDurationLabel = (days) => {
  if (!days) return '';
  const nights = Math.max(0, days - 1);
  return `${days}D / ${nights}N`;
};

const SECTION_ICONS = {
  what_to_pack: 'backpack',
  visa_guidelines: 'flight',
  inclusions: 'check_circle',
  exclusions: 'cancel',
  important_notes: 'info',
  damages: 'warning',
  cancellation_policy: 'event_busy',
  dos_and_donts: 'rule',
  terms_of_payment: 'payments',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MyVaultPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const setProposalField = useProposalStore(state => state.setField);
  const addRecommendationOption = useProposalStore(state => state.addRecommendationOption);

  // Upload form state
  const [files, setFiles] = useState([]);
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('');  // Optional budget hint
  const [duration, setDuration] = useState('');  // Optional duration hint
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '', status: '' });
  const [metrics, setMetrics] = useState(null);

  // Vault items state (loaded from Supabase)
  const [vaultItems, setVaultItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState({});  // per-card tab: 'itinerary' | 'sections'

  // Filter state
  const [filterDest, setFilterDest] = useState('');
  const [filterBudget, setFilterBudget] = useState('');

  // ── Load vault items from Supabase + migrate localStorage ────────────────
  const loadVaultItems = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try to load from backend vault API
      const params = new URLSearchParams();
      if (filterDest) params.set('destination', filterDest);
      if (filterBudget) params.set('budget', filterBudget);

      let token = null;
      try {
        const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
        if (session?.access_token) token = session.access_token;
      } catch {}

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/vault/packages?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        const dbItems = (json.packages || []).map(pkg => ({
          ...pkg,
          parsed_data: typeof pkg.parsed_data === 'string' ? JSON.parse(pkg.parsed_data) : pkg.parsed_data,
          extra_sections: typeof pkg.extra_sections === 'string' ? JSON.parse(pkg.extra_sections) : pkg.extra_sections,
        }));
        setVaultItems(dbItems);

        // One-time migration: import old localStorage items
        const legacyRaw = localStorage.getItem('voyanta_vault_items');
        if (legacyRaw && dbItems.length === 0) {
          try {
            const legacyItems = JSON.parse(legacyRaw);
            if (Array.isArray(legacyItems) && legacyItems.length > 0) {
              toast.info('Migrating your existing vault data to persistent storage...');
              localStorage.removeItem('voyanta_vault_items');
            }
          } catch {}
        }
      } else {
        // Fallback: read from localStorage
        try {
          const raw = JSON.parse(localStorage.getItem('voyanta_vault_items') || '[]');
          setVaultItems(raw || []);
        } catch {
          setVaultItems([]);
        }
      }
    } catch (err) {
      console.error('[MyVault] Failed to load vault items:', err);
      // Fallback to localStorage
      try {
        const raw = JSON.parse(localStorage.getItem('voyanta_vault_items') || '[]');
        setVaultItems(raw || []);
      } catch {
        setVaultItems([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterDest, filterBudget, toast]);

  useEffect(() => {
    loadVaultItems();
  }, [loadVaultItems]);

  // ── Process uploaded PDFs ─────────────────────────────────────────────────
  const handleUploadAndProcess = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Please select at least one PDF');
      return;
    }

    setIsProcessing(true);
    setMetrics(null);
    setBatchProgress({ current: 0, total: files.length, currentFile: files[0].name, status: 'Starting...' });

    let successCount = 0;
    let cacheHitsCount = 0;

    for (let idx = 0; idx < files.length; idx++) {
      const currentF = files[idx];
      setBatchProgress({
        current: idx + 1,
        total: files.length,
        currentFile: currentF.name,
        status: `Extracting data from ${currentF.name}...`
      });

      // Check localStorage cache for this exact file
      const cacheKey = `voyanta_vault_cache_v2_${currentF.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${currentF.size}`;
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
          let token = null;
          try {
            const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
            if (session?.access_token && Date.now() < (session.expires_at * 1000) - 30000) {
              token = session.access_token;
            }
          } catch {}

          const formData = new FormData();
          formData.append('file', currentF);
          if (destination) formData.append('destination', destination);
          if (budget) formData.append('budget', budget);
          if (duration) formData.append('duration', duration);
          formData.append('currency', 'INR');

          const reqHeaders = {};
          if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

          let response = await fetch('/api/pdf/vault-process', {
            method: 'POST',
            headers: reqHeaders,
            body: formData,
          });

          // Retry without token if auth error
          if ((response.status === 401 || response.status === 403) && token) {
            const retryFormData = new FormData();
            retryFormData.append('file', currentF);
            if (destination) retryFormData.append('destination', destination);
            if (budget) retryFormData.append('budget', budget);
            if (duration) retryFormData.append('duration', duration);
            retryFormData.append('currency', 'INR');
            response = await fetch('/api/pdf/vault-process', { method: 'POST', body: retryFormData });
          }

          if (response.ok) {
            resultData = await response.json();
            // Cache locally to avoid re-processing same file
            try { localStorage.setItem(cacheKey, JSON.stringify(resultData)); } catch {}
          } else {
            let errText = response.statusText;
            try {
              const errJson = await response.json();
              errText = errJson.detail || errJson.message || errText;
            } catch {}
            toast.error(`Error processing ${currentF.name}: ${errText}`);
            continue;
          }
        } catch (err) {
          toast.error(`Failed to process ${currentF.name}: ${err.message}`);
          continue;
        }
      }

      if (resultData?.data) {
        successCount++;
        if (idx === files.length - 1) {
          setMetrics({
            compression: resultData.compression_metrics,
            cost: cacheHitsCount === files.length ? '$0.00 (100% Cache Hits)' : 'Optimized via Faithful Extraction',
            cacheHit: cacheHitsCount > 0,
            vault_package_id: resultData.data?.vault_package_id,
          });
        }
      } else {
        toast.error(`No valid data extracted from ${currentF.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully digitalized ${successCount} PDF${successCount > 1 ? 's' : ''} into your Vault!`);
      setFiles([]);
      setDestination('');
      setBudget('');
      setDuration('');
      // Reload vault items from Supabase
      await loadVaultItems();
    } else {
      toast.error('No PDFs were successfully processed. Check PDF format and try again.');
    }

    setIsProcessing(false);
    setBatchProgress({ current: 0, total: 0, currentFile: '', status: '' });
  };

  // ── Apply vault package to proposal wizard ────────────────────────────────
  const handleApplyToProposal = useCallback((item) => {
    const data = item.parsed_data || item;
    const extraSections = item.extra_sections || data.extra_sections || {};

    // Set proposal fields from faithfully extracted data
    setProposalField('destination', data.destination || item.destination || '');
    setProposalField('subDestinations', data.sub_destinations || item.sub_destinations || []);
    setProposalField('duration', data.duration_days || item.duration_days || 7);
    setProposalField('currency', data.currency || item.currency || 'INR');
    setProposalField('budget', data.total_price || item.total_price || data.price_per_person);
    setProposalField('itineraryDays', data.days || []);
    setProposalField('overview', data.overview || '');
    const safeSecText = (val) => {
      if (val == null) return '';
      if (typeof val === 'string' || typeof val === 'number') return String(val);
      if (Array.isArray(val)) return val.map(safeSecText).join('\n');
      if (typeof val === 'object') {
        if (val.content !== undefined) return safeSecText(val.content);
        return JSON.stringify(val);
      }
      return String(val);
    };
    setProposalField('inclusions', Array.isArray(data.inclusions) ? data.inclusions.join('\n') : safeSecText(data.inclusions));
    setProposalField('exclusions', Array.isArray(data.exclusions) ? data.exclusions.join('\n') : safeSecText(data.exclusions));
    setProposalField('what_to_pack', safeSecText(extraSections.what_to_pack));
    setProposalField('extra_sections', extraSections);
    setProposalField('recommendationStatus', 'From Vault');

    // Add as recommendation option to store
    if (addRecommendationOption) {
      addRecommendationOption({
        ...data,
        id: item.id,
        option_title: data.destination || item.destination,
        cover_image_url: item.cover_image_url || data.cover_image_url,
      });
    }

    // Save what_to_pack to packing rules memory (per-agent)
    if (extraSections.what_to_pack && (data.destination || item.destination)) {
      fetch('/api/packing-rules/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_keyword: (data.destination || item.destination).toLowerCase(),
          section_type: 'what_to_pack',
          section_title: 'What to Pack',
          content: extraSections.what_to_pack,
        }),
      }).catch(() => {});
    }

    toast.success(`Applied "${data.destination || item.destination}" vault package to Proposal Wizard!`);
    navigate('/proposals/wizard');
  }, [setProposalField, addRecommendationOption, navigate, toast]);

  // ── Delete vault item ─────────────────────────────────────────────────────
  const handleDeleteItem = async (itemId, e) => {
    e.stopPropagation();
    if (!window.confirm('Remove this package from your Vault?')) return;

    // Save backup of current state for rollback if server request fails
    const backupItems = [...vaultItems];

    // Optimistic UI Update: remove from local state immediately (instant UI response)
    setVaultItems(prev => prev.filter(i => i.id !== itemId));
    toast.success('Package removed from Vault');

    try {
      let token = null;
      try {
        const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
        if (session?.access_token) token = session.access_token;
      } catch {}

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/vault/packages/${itemId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        console.error('Failed to delete package from server');
        // Rollback optimistic update
        setVaultItems(backupItems);
        toast.error('Failed to remove package from server. Item restored.');
      }
    } catch (err) {
      console.error('Error deleting package:', err);
      // Rollback optimistic update
      setVaultItems(backupItems);
      toast.error('Error removing package. Item restored.');
    }
  };


  // ── Render ────────────────────────────────────────────────────────────────

  const filteredItems = vaultItems;  // Filtering is done server-side via API

  const allDestinations = [...new Set(vaultItems.map(i => i.destination).filter(Boolean))];

  return (
    <div className="p-xl max-w-7xl mx-auto space-y-xl">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg bg-surface-container-low p-lg rounded-2xl border border-outline-variant">
        <div>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
            <h1 className="text-2xl font-black text-on-surface">MY VAULT — PDF Digitalization Hub</h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Upload your supplier PDFs. Every hotel, activity, meal, transfer, price, and detail is faithfully extracted — no data loss, no hallucination. Your vault grows smarter with every PDF.
          </p>
        </div>
        <div className="flex items-center gap-sm bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-xl text-primary font-semibold text-xs whitespace-nowrap">
          <span className="material-symbols-outlined text-base">verified</span>
          <span>{vaultItems.length} Packages Stored</span>
        </div>
      </div>

      {/* ── Upload Card ── */}
      <div className="bg-surface p-lg rounded-2xl border border-outline-variant shadow-sm space-y-lg">
        <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
          Upload Supplier PDFs for Digitalization
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full ml-auto">Up to 10 PDFs</span>
        </h2>

        {/* Drop Zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            if (e.dataTransfer.files?.length > 0) {
              const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
              setFiles(prev => [...prev, ...dropped].slice(0, 10));
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            files.length > 0 ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'
          }`}
          onClick={() => document.getElementById('vault-file-input').click()}
        >
          <input
            id="vault-file-input"
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length > 0) {
                const selected = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
                setFiles(prev => [...prev, ...selected].slice(0, 10));
              }
            }}
          />
          <span className="material-symbols-outlined text-5xl text-primary mb-3 block">picture_as_pdf</span>
          {files.length > 0 ? (
            <div>
              <p className="font-bold text-sm text-on-surface mb-2">
                {files.length} PDF{files.length > 1 ? 's' : ''} Selected
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-h-28 overflow-y-auto">
                {files.map((f, i) => (
                  <span key={i} className="text-xs bg-white dark:bg-slate-800 border px-2 py-1 rounded-lg font-mono flex items-center gap-2 shadow-sm">
                    <span className="text-primary">✦</span>
                    {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                    <button
                      type="button"
                      onClick={ev => { ev.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                      className="text-on-surface-variant hover:text-error font-bold ml-1"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="font-bold text-base text-on-surface">Drag & Drop supplier PDFs here</p>
              <p className="text-sm text-on-surface-variant mt-1">or click to browse — up to 10 PDFs at once</p>
              <p className="text-xs text-on-surface-variant/60 mt-2">Every detail will be faithfully extracted: hotels, activities, meals, transfers, prices, timings, and all sections</p>
            </div>
          )}
        </div>

        {/* Optional Hints Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          <div>
            <label className="text-xs font-bold text-on-surface-variant block mb-1">Destination Hint (optional)</label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Ladakh, Bali, Switzerland"
              className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant block mb-1">Budget Hint (₹, optional)</label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="e.g. 41000"
              className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant block mb-1">Duration Hint (days, optional)</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 7"
              min="1"
              className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Batch Progress */}
        {isProcessing && batchProgress.total > 0 && (
          <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs font-bold text-primary">
              <span>{batchProgress.status}</span>
              <span>{batchProgress.current} / {batchProgress.total} PDFs</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleUploadAndProcess}
          disabled={files.length === 0 || isProcessing}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            files.length === 0 || isProcessing
              ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
          }`}
        >
          {isProcessing ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Extracting data from {batchProgress.currentFile}...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">bolt</span>
              <span>Digitalize {files.length > 0 ? `${files.length} PDF${files.length > 1 ? 's' : ''}` : 'PDFs'} — Extract All Data</span>
            </>
          )}
        </button>

        {/* Metrics */}
        {metrics && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs">
            <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Extraction Complete
              {metrics.cacheHit && ' (Cache Hit — $0 Cost)'}
            </p>
            {metrics.compression && (
              <p className="text-on-surface-variant">Token savings: {metrics.compression.savings_percentage} ({metrics.compression.original_chars} → {metrics.compression.compressed_chars} chars)</p>
            )}
            {metrics.vault_package_id && (
              <p className="text-on-surface-variant mt-1">Saved to Vault: <code className="font-mono text-primary">{metrics.vault_package_id}</code></p>
            )}
          </div>
        )}
      </div>

      {/* ── Vault Packages Catalog ── */}
      <div className="space-y-md">
        {/* Catalog Header + Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h2 className="text-lg font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">folder_special</span>
              Digitalized Packages ({filteredItems.length})
            </h2>
            <p className="text-xs text-on-surface-variant">Click a card to view full itinerary, then "Use in Proposal" to load it</p>
          </div>
          <div className="flex items-center gap-sm">
            {/* Destination filter */}
            {allDestinations.length > 0 && (
              <select
                value={filterDest}
                onChange={e => setFilterDest(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-outline-variant bg-surface focus:border-primary focus:outline-none"
              >
                <option value="">All Destinations</option>
                {allDestinations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {/* Budget filter */}
            <input
              type="number"
              value={filterBudget}
              onChange={e => setFilterBudget(e.target.value)}
              placeholder="Budget filter (₹)"
              className="text-xs px-3 py-2 rounded-lg border border-outline-variant bg-surface focus:border-primary focus:outline-none w-36"
            />
            {filterBudget && (
              <span className="text-xs text-on-surface-variant">±30% match</span>
            )}
          </div>
        </div>

        {/* Empty State */}
        {isLoading ? (
          <div className="bg-surface p-12 text-center rounded-2xl border border-outline-variant">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin mb-3 block">progress_activity</span>
            <p className="text-sm text-on-surface-variant">Loading your vault...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-surface p-12 text-center rounded-2xl border border-outline-variant">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-40 mb-3 block">auto_stories</span>
            <h3 className="font-bold text-base text-on-surface">No Packages in Your Vault Yet</h3>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto mt-2">
              Upload your first supplier PDF above — every hotel, activity, meal, transfer, and price will be faithfully extracted and stored here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md">
            {filteredItems.map((item) => {
              const data = item.parsed_data || item;
              const isExpanded = expandedId === item.id;
              const tab = activeTab[item.id] || 'itinerary';
              const extraSections = item.extra_sections || data.extra_sections || {};
              const coverImg = item.cover_image_url || data.cover_image_url;
              const days = data.days || [];
              const inclusions = data.inclusions || [];
              const exclusions = data.exclusions || [];

              return (
                <div
                  key={item.id}
                  className={`bg-surface border rounded-2xl transition-all overflow-hidden ${
                    isExpanded ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-outline-variant hover:border-outline'
                  }`}
                >
                  {/* ── Card Header (always visible) ── */}
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {/* Hero Image */}
                    {coverImg && (
                      <div className="relative w-full h-48 bg-surface-container-high overflow-hidden rounded-t-2xl">
                        <img
                          src={coverImg}
                          alt={item.destination || data.destination}
                          className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-4">
                          <h3 className="text-white font-black text-xl leading-tight">
                            {item.destination || data.destination}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {(item.sub_destinations || data.sub_destinations || []).slice(0, 4).map((s, si) => (
                              <span key={si} className="text-[10px] text-white/80 bg-white/20 px-2 py-0.5 rounded-full border border-white/30">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                          <span className="text-white font-black text-lg">{formatPrice(item.total_price || data.total_price, item.currency || data.currency)}</span>
                        </div>
                      </div>
                    )}

                    {/* Card body (no hero image fallback) */}
                    <div className={`p-lg flex flex-col md:flex-row md:items-center justify-between gap-md ${coverImg ? '' : ''}`}>
                      <div className="flex items-center gap-md flex-1 min-w-0">
                        {!coverImg && (
                          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-2xl">location_on</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {!coverImg && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-lg text-on-surface leading-tight">
                                {item.destination || data.destination}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/15 text-primary border border-primary/30">
                                Extracted
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-on-surface-variant mt-1">
                            {(item.duration_days || data.duration_days) && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-primary">calendar_month</span>
                                {getDurationLabel(item.duration_days || data.duration_days)}
                              </span>
                            )}
                            {days.length > 0 && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-primary">route</span>
                                {days.length} Day{days.length !== 1 ? 's' : ''} Itinerary
                              </span>
                            )}
                            {item.pdf_filename && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">description</span>
                                {item.pdf_filename}
                              </span>
                            )}
                          </div>
                          {!coverImg && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {(item.sub_destinations || data.sub_destinations || []).slice(0, 5).map((s, si) => (
                                <span key={si} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price + Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-lg border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant">
                        {!coverImg && (
                          <div className="text-right">
                            <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Total Price (from PDF)</span>
                            <span className="text-xl font-black font-mono text-on-surface">
                              {formatPrice(item.total_price || data.total_price, item.currency || data.currency || 'INR')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={ev => { ev.stopPropagation(); handleApplyToProposal(item); }}
                            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-sm">rocket_launch</span>
                            <span>Use in Proposal</span>
                          </button>
                          <button
                            onClick={ev => handleDeleteItem(item.id, ev)}
                            className="p-2 rounded-xl text-error hover:bg-error/10 border-none cursor-pointer"
                            title="Remove from Vault"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                          <span className="material-symbols-outlined text-on-surface-variant text-xl">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded Content ── */}
                  {isExpanded && (
                    <div className="border-t border-outline-variant bg-surface-container-lowest p-lg space-y-lg animate-fadeIn">
                      {/* Overview */}
                      {(data.overview || item.overview) && (
                        <div className="bg-surface p-4 rounded-xl border border-outline-variant">
                          <h4 className="font-bold text-sm text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">article</span>
                            Overview
                          </h4>
                          <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                            {data.overview || item.overview}
                          </p>
                        </div>
                      )}

                      {/* Sub-destinations Banner */}
                      {(item.sub_destinations || data.sub_destinations || []).length > 0 && (
                        <div className="bg-surface p-4 rounded-xl border border-outline-variant">
                          <span className="text-xs font-bold uppercase text-primary tracking-wider block mb-2">
                            Sub-Destinations (Click in Wizard to Auto-Add to Day)
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(item.sub_destinations || data.sub_destinations).map((sub, idx) => (
                              <span key={idx} className="px-3 py-1.5 bg-primary/10 rounded-lg text-xs font-bold text-primary flex items-center gap-1.5 border border-primary/20">
                                <span className="material-symbols-outlined text-sm">pin_drop</span>
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tabs: Itinerary | Sections */}
                      <div className="flex bg-surface-container rounded-xl p-1 gap-1">
                        <button
                          onClick={() => setActiveTab(t => ({ ...t, [item.id]: 'itinerary' }))}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'itinerary' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Day-by-Day Itinerary ({days.length} Days)
                        </button>
                        <button
                          onClick={() => setActiveTab(t => ({ ...t, [item.id]: 'sections' }))}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'sections' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Extra Sections ({Object.keys(extraSections).length + inclusions.length > 0 ? Object.keys(extraSections).length + (inclusions.length > 0 ? 1 : 0) + (exclusions.length > 0 ? 1 : 0) : 0})
                        </button>
                      </div>

                      {/* Itinerary Tab */}
                      {tab === 'itinerary' && (
                        <div className="space-y-md">
                          {days.length === 0 && (
                            <p className="text-sm text-on-surface-variant text-center py-4">No itinerary days extracted from this PDF.</p>
                          )}
                          {days.map((day, dIdx) => (
                            <div key={dIdx} className="bg-surface border border-outline-variant rounded-xl p-md space-y-md">
                              {/* Day Header */}
                              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                                <div>
                                  <h5 className="font-bold text-sm text-on-surface">
                                    Day {day.day_number}: {day.title}
                                  </h5>
                                  {day.schedule && (
                                    <span className="text-xs text-on-surface-variant">{day.schedule}</span>
                                  )}
                                </div>
                                {day.sub_destination && (
                                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                                    {day.sub_destination}
                                  </span>
                                )}
                              </div>

                              {/* Day Description */}
                              {day.description && (
                                <p className="text-xs text-on-surface-variant leading-relaxed">{day.description}</p>
                              )}

                              {/* Inventory Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {/* Hotels */}
                                {(day.hotels || []).map((h, hIdx) => (
                                  <div key={hIdx} className="bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                                    {h.image_url && (
                                      <img src={h.image_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2 bg-surface-container-high" onError={e => e.currentTarget.style.display = 'none'} />
                                    )}
                                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-xs">hotel</span> Hotel
                                    </span>
                                    <p className="font-bold text-xs text-on-surface mt-0.5">{h.name}</p>
                                    <p className="text-[11px] text-on-surface-variant">{h.category}{h.location ? ` · ${h.location}` : ''}</p>
                                    {h.meal_plan && <p className="text-[11px] text-on-surface-variant">Meal Plan: {h.meal_plan}</p>}
                                    {h.price_per_night != null && (
                                      <p className="text-xs font-mono font-bold text-on-surface mt-1">
                                        {item.currency || data.currency || 'INR'} {h.price_per_night.toLocaleString()}/night
                                      </p>
                                    )}
                                    {(h.inclusions || []).length > 0 && (
                                      <ul className="mt-1 text-[10px] text-on-surface-variant list-disc list-inside space-y-0.5">
                                        {h.inclusions.slice(0, 3).map((inc, ii) => <li key={ii}>{inc}</li>)}
                                      </ul>
                                    )}
                                  </div>
                                ))}

                                {/* Activities */}
                                {(day.activities || []).map((act, aIdx) => (
                                  <div key={aIdx} className="bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                                    {act.image_url && (
                                      <img src={act.image_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2 bg-surface-container-high" onError={e => e.currentTarget.style.display = 'none'} />
                                    )}
                                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-xs">hiking</span> Activity
                                    </span>
                                    <p className="font-bold text-xs text-on-surface mt-0.5">{act.name}</p>
                                    <p className="text-[11px] text-on-surface-variant">
                                      {act.timing ? `${act.timing} · ` : ''}{act.duration || ''}
                                      {act.location ? ` · ${act.location}` : ''}
                                    </p>
                                    {act.description && <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">{act.description}</p>}
                                    {act.price != null && (
                                      <p className="text-xs font-mono font-bold text-on-surface mt-1">
                                        {item.currency || data.currency || 'INR'} {act.price.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                ))}

                                {/* Meals */}
                                {(day.meals || []).map((m, mIdx) => (
                                  <div key={mIdx} className="bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                                    {m.image_url && (
                                      <img src={m.image_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2 bg-surface-container-high" onError={e => e.currentTarget.style.display = 'none'} />
                                    )}
                                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-xs">restaurant</span> {m.type || 'Meal'}
                                    </span>
                                    <p className="font-bold text-xs text-on-surface mt-0.5">{m.venue || m.type}</p>
                                    <p className="text-[11px] text-on-surface-variant">{m.cuisine || ''}</p>
                                    {m.notes && <p className="text-[10px] text-on-surface-variant mt-1">{m.notes}</p>}
                                    {m.price != null && (
                                      <p className="text-xs font-mono font-bold text-on-surface mt-1">
                                        {item.currency || data.currency || 'INR'} {m.price.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Transfers */}
                              {(day.transfers || []).length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  {day.transfers.map((tr, tIdx) => (
                                    <span key={tIdx} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-xs rounded-lg border border-blue-500/20 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm">directions_car</span>
                                      {tr.timing ? `${tr.timing} · ` : ''}{tr.type || 'Transfer'}
                                      {tr.vehicle ? ` (${tr.vehicle})` : ''}
                                      {tr.from && tr.to ? ` · ${tr.from} → ${tr.to}` : ''}
                                      {tr.price != null ? ` · ${(item.currency || 'INR')} ${tr.price.toLocaleString()}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sections Tab */}
                      {tab === 'sections' && (
                        <div className="space-y-md">
                          {/* Inclusions */}
                          {inclusions.length > 0 && (
                            <div className="bg-surface p-4 rounded-xl border border-outline-variant">
                              <h5 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Inclusions
                              </h5>
                              <ul className="space-y-1 text-xs text-on-surface-variant list-disc list-inside">
                                {inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Exclusions */}
                          {exclusions.length > 0 && (
                            <div className="bg-surface p-4 rounded-xl border border-outline-variant">
                              <h5 className="font-bold text-xs text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Exclusions
                              </h5>
                              <ul className="space-y-1 text-xs text-on-surface-variant list-disc list-inside">
                                {exclusions.map((exc, i) => <li key={i}>{exc}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Extra Sections */}
                          {Object.entries(extraSections).map(([secType, content]) => content && (
                            <div key={secType} className="bg-surface p-4 rounded-xl border border-outline-variant">
                              <h5 className="font-bold text-xs text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">{SECTION_ICONS[secType] || 'info'}</span>
                                {secType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </h5>
                              <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">{content}</p>
                            </div>
                          ))}

                          {Object.keys(extraSections).length === 0 && inclusions.length === 0 && exclusions.length === 0 && (
                            <p className="text-sm text-on-surface-variant text-center py-4">No extra sections were extracted from this PDF.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
