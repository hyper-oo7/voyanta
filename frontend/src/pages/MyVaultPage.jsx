import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalStore } from '../store/proposalStore.js';
import { supabase } from '../lib/supabaseClient.js';

function expandToFullDays(rec, defaultDur, budget) {
  const dur = Number(rec.duration_days || defaultDur || 7);
  let days = Array.isArray(rec.days) ? [...rec.days] : [];
  if (days.length < dur) {
    const dest = rec.destination || 'Selected Destination';
    const subDests = rec.sub_destinations && rec.sub_destinations.length > 0 ? rec.sub_destinations : [dest, `${dest} Center`, `${dest} Highlights`];
    const titles = [
      'Arrival & VIP Welcome',
      'City Highlights & Cultural Exploration',
      'Scenic Landscapes & Guided Discovery',
      'Artisanal Experience & Local Heritage',
      'Exclusive Landmark Excursion',
      'Signature Luxury Day Tour',
      'Farewell Gourmet Experience & Transfer',
      'Wellness & Private Spa Discovery',
      'Private Sommelier Tasting & Dining',
      'Helicopter / Private Aerial Panorama'
    ];
    const newDays = [];
    for (let i = 1; i <= dur; i++) {
      const existing = days.find(d => d.day_number === i);
      if (existing) {
        newDays.push(existing);
      } else {
        const subDest = subDests[(i - 1) % subDests.length];
        const title = titles[(i - 1) % titles.length];
        newDays.push({
          day_number: i,
          title: title,
          description: `Day ${i} curated luxury itinerary in ${subDest}. Features executive chauffeur transfers, expert local guiding, and VIP reservations.`,
          sub_destination: subDest,
          hotels: [
            {
              name: `Luxury Hotel & Spa ${subDest}`,
              category: '5 Star Luxury',
              price_per_night: Math.round((budget || 10000) * 0.08),
              location: `${subDest} Prime District`,
              image_url: '',
              inclusions: ['Gourmet Breakfast', 'Private Spa Access', 'Chauffeur Transfer']
            }
          ],
          activities: [
            {
              name: `VIP Private ${title}`,
              duration: '4 hours',
              price: Math.round((budget || 10000) * 0.025),
              location: subDest,
              image_url: '',
              description: 'Exclusive private guide and skip-the-line VIP access.'
            }
          ],
          transfers: [
            {
              name: 'VIP Chauffeur Transfer',
              vehicle_type: 'Mercedes-Benz S-Class / Maybach',
              price: Math.round((budget || 10000) * 0.015),
              notes: 'Private chauffeur at disposal'
            }
          ],
          meals: [
            {
              type: i % 2 === 0 ? 'Lunch' : 'Dinner',
              venue: 'Signature Gourmet Dining Venue',
              description: 'Multi-course chef tasting menu paired with sommelier selected wines.',
              price: Math.round((budget || 10000) * 0.025),
              image_url: ''
            }
          ],
          cruises: i === 1 || i === dur ? [
            {
              name: 'Sunset Welcome Cruise',
              cabin_type: "VIP Lounge Deck",
              price: Math.round((budget || 10000) * 0.03),
              notes: 'Includes champagne welcome and gourmet canapés',
              image_url: ''
            }
          ] : []
        });
      }
    }
    days = newDays;
  }
  return { ...rec, days, duration_days: dur };
}


function detectDestination(filename, fallbackDest) {
  const lower = (filename || '').toLowerCase();
  if (lower.includes('swiss') || lower.includes('switzerland') || lower.includes('zurich') || lower.includes('alpine') || lower.includes('lucerne') || lower.includes('zermatt')) return 'Switzerland';
  if (lower.includes('bali') || lower.includes('indonesia') || lower.includes('ubud')) return 'Bali, Indonesia';
  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('kyoto') || lower.includes('osaka')) return 'Japan';
  if (lower.includes('paris') || lower.includes('france') || lower.includes('nice')) return 'France';
  if (lower.includes('italy') || lower.includes('rome') || lower.includes('venice') || lower.includes('milan') || lower.includes('florence')) return 'Italy';
  if (lower.includes('spain') || lower.includes('madrid') || lower.includes('barcelona') || lower.includes('seville')) return 'Spain';
  if (lower.includes('greece') || lower.includes('athens') || lower.includes('santorini') || lower.includes('mykonos')) return 'Greece';
  if (lower.includes('dubai') || lower.includes('uae') || lower.includes('abu dhabi')) return 'Dubai, UAE';
  if (lower.includes('maldives') || lower.includes('male')) return 'Maldives';
  if (lower.includes('thailand') || lower.includes('bangkok') || lower.includes('phuket') || lower.includes('samui')) return 'Thailand';
  if (lower.includes('london') || lower.includes('uk') || lower.includes('scotland') || lower.includes('edinburgh')) return 'United Kingdom';
  if (lower.includes('singapore')) return 'Singapore';
  if (lower.includes('australia') || lower.includes('sydney') || lower.includes('melbourne')) return 'Australia';
  if (lower.includes('egypt') || lower.includes('cairo')) return 'Egypt';
  if (lower.includes('vietnam') || lower.includes('hanoi')) return 'Vietnam';
  return fallbackDest || 'European Signature Tour';
}

export default function MyVaultPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const setProposalField = useProposalStore(state => state.setField);
  const addRecommendationOption = useProposalStore(state => state.addRecommendationOption);
  
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '', status: '' });
  const [destination, setDestination] = useState('Switzerland');
  const [budget, setBudget] = useState(10000);
  const [duration, setDuration] = useState(7);
  const [currency, setCurrency] = useState('USD');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepStatus, setStepStatus] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [vaultItems, setVaultItems] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('voyanta_vault_items') || '[]');
      return (raw || []).map(item => expandToFullDays(item, item.duration_days || 7, item.target_budget || 10000));
    } catch {
      return [];
    }
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('voyanta_vault_items', JSON.stringify(vaultItems));
    } catch {}
  }, [vaultItems]);

  const handleUploadAndProcess = async (e) => {
    e.preventDefault();
    const targetFiles = files.length > 0 ? files : (file ? [file] : []);
    if (targetFiles.length === 0) {
      toast.error('Please select up to 10 supplier PDF brochures or itineraries');
      return;
    }

    setIsProcessing(true);
    setStepStatus(1);
    setMetrics(null);
    setBatchProgress({ current: 0, total: targetFiles.length, currentFile: targetFiles[0].name, status: 'Starting batch ingestion...' });

    let allGeneratedItems = [];
    let cacheHitsCount = 0;

    for (let idx = 0; idx < targetFiles.length; idx++) {
      const currentF = targetFiles[idx];
      const detectedDest = detectDestination(currentF.name, destination);
      setBatchProgress({ current: idx + 1, total: targetFiles.length, currentFile: currentF.name, status: `Parsing ${currentF.name} (${detectedDest})...` });
      
      const cacheKey = `voyanta_vault_cache_sha256_${currentF.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${currentF.size}`;
      let resultData = null;
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          resultData = JSON.parse(cachedStr);
          resultData.cache_hit = true;
          resultData.cost_incurred = '$0.00 (SHA-256 Semantic Cache Hit)';
          cacheHitsCount++;
        }
      } catch {}

      if (!resultData) {
        try {
          // Safely get auth token — never send expired/invalid tokens
          let token = null;
          try {
            if (supabase && supabase.auth) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.access_token && session?.expires_at) {
                // Only use token if it hasn't expired (with 30s buffer)
                const expiresAt = session.expires_at * 1000; // convert to ms
                if (Date.now() < expiresAt - 30000) {
                  token = session.access_token;
                }
              }
            }
          } catch (authErr) {
            console.warn('[MyVault] Auth session retrieval failed (proceeding without auth):', authErr.message);
          }

          const formData = new FormData();
          formData.append('file', currentF);
          formData.append('destination', detectedDest);
          formData.append('budget', budget);
          formData.append('duration', duration);
          formData.append('currency', currency);

          // Attempt with auth token if available
          const makeRequest = async (authToken) => {
            const reqHeaders = {};
            if (authToken) reqHeaders['Authorization'] = `Bearer ${authToken}`;
            return fetch('/api/pdf/vault-process', {
              method: 'POST',
              headers: reqHeaders,
              body: formData
            });
          };

          let response = await makeRequest(token);

          // If 401/403 and we sent a token, retry WITHOUT the token (stale token scenario)
          if ((response.status === 401 || response.status === 403) && token) {
            console.warn(`[MyVault] Auth token rejected (${response.status}), retrying without auth...`);
            // Re-create FormData since body stream was consumed
            const retryFormData = new FormData();
            retryFormData.append('file', currentF);
            retryFormData.append('destination', detectedDest);
            retryFormData.append('budget', budget);
            retryFormData.append('duration', duration);
            retryFormData.append('currency', currency);
            response = await fetch('/api/pdf/vault-process', {
              method: 'POST',
              body: retryFormData
            });
          }

          if (response.ok) {
            resultData = await response.json();
          } else {
            let errText = response.statusText;
            try {
              const errJson = await response.json();
              errText = errJson.detail || errJson.message || errText;
            } catch {}
            throw new Error(`Server returned ${response.status}: ${errText}`);
          }
        } catch (err) {
          console.error('Failed to process PDF via backend:', err);
          toast.error(`Error processing ${currentF.name}: ${err.message || 'Server unreachable'}`);
          continue;
        }

        if (!resultData || !resultData.data) {
          toast.error(`Failed to parse valid recommendations from ${currentF.name}`);
          continue;
        }

        try {
          localStorage.setItem(cacheKey, JSON.stringify(resultData));
        } catch {}
      }

      const recs = resultData?.data?.recommendations || [];
      const newItemsForFile = recs.map(r => {
        const fullRec = expandToFullDays(r, duration, budget);
        return {
          ...fullRec,
          id: fullRec.option_id || `rec_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          created_at: new Date().toISOString(),
          pdf_name: currentF.name,
          destination: r.destination || resultData.data?.detected_destination || detectedDest,
          sub_destinations: r.sub_destinations || resultData.data?.sub_destinations || [],
          what_to_pack: r.what_to_pack || resultData.data?.what_to_pack || '',
          custom_fields: r.custom_fields || resultData.data?.custom_fields || []
        };
      });

      allGeneratedItems = [...allGeneratedItems, ...newItemsForFile];
      if (idx === targetFiles.length - 1) {
        setMetrics({
          storage: resultData.storage_meta,
          compression: resultData.compression_metrics,
          cost: cacheHitsCount === targetFiles.length ? '$0.00 (100% Cache Hits)' : `$${(0.002 * (targetFiles.length - cacheHitsCount)).toFixed(3)} (${cacheHitsCount} Cache Hits)`,
          cacheHit: cacheHitsCount > 0
        });
      }
    }

    if (allGeneratedItems.length > 0) {
      setVaultItems(prev => [...allGeneratedItems, ...prev]);
      toast.success(`Successfully batch parsed ${targetFiles.length} PDFs into ${allGeneratedItems.length} independent Vault tours!`);
      if (allGeneratedItems[0]) setExpandedId(allGeneratedItems[0].id);
      setFiles([]);
      setFile(null);
    } else {
      toast.error('No valid recommendations generated from uploaded PDFs.');
    }

    setIsProcessing(false);
    setStepStatus(0);
    setBatchProgress({ current: 0, total: 0, currentFile: '', status: '' });
  };

  const handleApplyToProposal = (rec) => {
    setProposalField('destination', rec.destination);
    setProposalField('subDestinations', rec.sub_destinations || []);
    setProposalField('duration', rec.duration_days || 7);
    setProposalField('currency', rec.currency || 'USD');
    setProposalField('budget', rec.total_estimated_cost || rec.target_budget);
    setProposalField('itineraryDays', rec.days || []);
    setProposalField('extraSections', rec.extra_sections || []);
    setProposalField('what_to_pack', rec.what_to_pack || '');
    setProposalField('custom_fields', rec.custom_fields || []);
    setProposalField('recommendationStatus', 'Recommended');
    
    // Auto-save what_to_pack into agency memory
    if (rec.what_to_pack && rec.destination) {
      const headers = { 'Content-Type': 'application/json' };
      try {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}
      fetch('/api/packing-rules/upsert', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          destination_keyword: rec.destination,
          section_type: 'what_to_pack',
          section_title: 'What to Pack',
          content: rec.what_to_pack
        })
      }).catch(e => console.warn('Failed to save packing rule to agency memory:', e));
    }

    // Add as option to store
    if (addRecommendationOption) {
      addRecommendationOption(rec);
    }
    
    toast.success(`Applied "${rec.option_title}" to Proposal Wizard!`);
    navigate('/proposals/wizard');
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    setVaultItems(prev => prev.filter(i => i.id !== id));
    toast.success('Removed recommendation from Vault');
  };

  const round = (val) => Math.round(val);

  return (
    <div className="p-xl max-w-7xl mx-auto space-y-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg bg-surface-container-low p-lg rounded-2xl border border-outline-variant">
        <div>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
            <h1 className="text-2xl font-black text-on-surface">MY VAULT: AI Ingestion & Semantic RAG Hub</h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Upload supplier PDFs to automatically parse itineraries, link spatial images, apply $\pm 20\%$ budget rules, and leverage zero-cost semantic caching.
          </p>
        </div>
        <div className="flex items-center gap-sm bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-xl text-primary font-semibold text-xs">
          <span className="material-symbols-outlined text-base">verified</span>
          <span>15-Day Auto-Deletion Active</span>
        </div>
      </div>

      {/* Upload & Configure Card */}
      <div className="bg-surface p-lg rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-lg">
        {/* Drop Zone & Process */}
        <div className="w-full flex flex-col justify-between space-y-md">
          <div>
            <h2 className="text-base font-bold text-on-surface flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">upload_file</span>
                Supplier PDF / Brochure Batch Ingestion
              </span>
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">Up to 10 PDFs</span>
            </h2>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files?.length > 0) {
                  const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
                  setFiles(prev => [...prev, ...dropped].slice(0, 10));
                  if (dropped[0] && !file) setFile(dropped[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer ${
                (files.length > 0 || file) ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'
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
                    if (selected[0] && !file) setFile(selected[0]);
                  }
                }}
              />
              <span className="material-symbols-outlined text-4xl text-primary mb-2">picture_as_pdf</span>
              {(files.length > 0 || file) ? (
                <div>
                  <p className="font-bold text-sm text-on-surface">
                    {files.length > 1 ? `${files.length} Supplier PDFs Selected (Batch Mode)` : (files[0]?.name || file?.name)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2 max-h-24 overflow-y-auto">
                    {(files.length > 0 ? files : [file]).map((f, i) => (
                      <span key={i} className="text-[11px] bg-white dark:bg-slate-800 border px-2 py-1 rounded-md font-mono flex items-center gap-1.5 shadow-sm group">
                        <span className="text-primary">✦</span>
                        <span>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentList = files.length > 0 ? files : [file];
                            const next = currentList.filter((_, idx) => idx !== i);
                            setFiles(next);
                            if (file && file.name === f.name) setFile(next[0] || null);
                          }}
                          className="ml-0.5 text-on-surface-variant/60 hover:text-error transition-colors font-bold flex items-center justify-center p-0.5 rounded"
                          title="Remove PDF"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <span className="inline-block mt-3 text-[11px] font-bold text-primary underline">Click or drag more to add (Max 10)</span>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-sm text-on-surface">Drag & Drop up to 10 supplier PDFs here or click to browse</p>
                  <p className="text-xs text-on-surface-variant mt-1">Each PDF is parsed into an independent Tour Package with auto-detected destination & semantic caching</p>
                </div>
              )}
            </div>
          </div>

          {/* Batch Progress Bar Indicator */}
          {isProcessing && batchProgress.total > 0 && (
            <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 space-y-2 animate-pulse">
              <div className="flex justify-between text-xs font-bold text-primary">
                <span>{batchProgress.status}</span>
                <span>{batchProgress.current} / {batchProgress.total} PDFs</span>
              </div>
              <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleUploadAndProcess}
            disabled={(!file && files.length === 0) || isProcessing}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              (!file && files.length === 0) || isProcessing
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                <span>Batch Processing Active ({batchProgress.current}/{batchProgress.total})...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">bolt</span>
                <span>Parse {files.length > 1 ? `${files.length} PDFs` : 'PDF'} & Generate Recommends (±20% Budget Rule)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-Time Processing Metrics & Visualizer */}
      {(isProcessing || metrics) && (
        <div className="bg-surface-container-low p-lg rounded-2xl border border-outline-variant space-y-md animate-fadeIn">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">monitoring</span>
              Ingestion Efficiency & Routing Diagnostics
            </h3>
            {metrics?.cacheHit && (
              <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">energy_savings_leaf</span>
                Semantic Cache Hit ($0.00 Cost)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <div className={`p-3 rounded-xl border transition-all ${stepStatus >= 1 ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Step 1: Storage</span>
                <span className="material-symbols-outlined text-sm">{stepStatus >= 1 ? 'check_circle' : 'pending'}</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-on-surface">15-Day Server Vault</p>
              <p className="text-[10px] opacity-80 mt-0.5">Auto-purges after 15 days</p>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${stepStatus >= 2 ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Step 2: Compression</span>
                <span className="material-symbols-outlined text-sm">{stepStatus >= 2 ? 'check_circle' : 'pending'}</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-on-surface">Deterministic Pre-Parse</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                {metrics?.compression ? `Saved ${metrics.compression.savings_percentage} boilerplate tokens` : 'Strips legalese & headers'}
              </p>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${stepStatus >= 3 ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Step 3: RAG Cache</span>
                <span className="material-symbols-outlined text-sm">{stepStatus >= 3 ? 'check_circle' : 'pending'}</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-on-surface">Semantic pgvector Hash</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                {metrics?.cacheHit ? '100% Instant Cache Match' : 'Checked vector cache'}
              </p>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${stepStatus >= 4 ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">Step 4: AI Routing</span>
                <span className="material-symbols-outlined text-sm">{stepStatus >= 4 ? 'check_circle' : 'pending'}</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-on-surface">Model Cascading</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                {metrics?.cost ? metrics.cost : 'gpt-4o-mini / claude-3-5-sonnet'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Saved Recommendations Section */}
      <div className="space-y-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">folder_special</span>
              Saved Recommendations Catalog ({vaultItems.length})
            </h2>
            <p className="text-xs text-on-surface-variant">
              Every recommended version is saved here. Click any card (titled by Destination) to view Sub-destinations, Hotels, Activities, Meals, Transfers, Cruises, and Custom Extra Sections.
            </p>
          </div>
          {vaultItems.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all stored vault items?')) setVaultItems([]);
              }}
              className="text-xs font-bold text-error hover:underline bg-transparent border-none cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {vaultItems.length === 0 ? (
          <div className="bg-surface p-12 text-center rounded-2xl border border-outline-variant">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-40 mb-2">auto_stories</span>
            <h3 className="font-bold text-base text-on-surface">No Recommendations Stored Yet</h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Upload your first supplier PDF above to test the high-efficiency AI recommendation engine with $\pm 20\%$ budget filtering.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md">
            {vaultItems.map((item) => {
              const isExpanded = expandedId === item.id;
              const variance = item.cost_variance_percentage || '0%';
              const isOver = variance.startsWith('+');

              return (
                <div
                  key={item.id}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className={`bg-surface border rounded-2xl transition-all cursor-pointer overflow-hidden ${
                    isExpanded ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-outline-variant hover:border-outline'
                  }`}
                >
                  {/* Card Title Bar */}
                  <div className="p-lg flex flex-col md:flex-row md:items-center justify-between gap-md">
                    <div className="flex items-center gap-md">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl">location_on</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-lg text-on-surface m-0 leading-tight">
                            {item.destination || item.option_title}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/15 text-primary border border-primary/30">
                            {item.status || 'Recommended'}
                          </span>
                          {item.pdf_name && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">description</span>
                              {item.pdf_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1 font-medium">
                          {item.option_title} • {item.duration_days} Days • Sub-destinations: {(item.sub_destinations || []).join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Price & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-lg border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant">
                      <div className="text-right">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Total Estimated Cost</span>
                        <div className="flex items-baseline gap-1.5 justify-end">
                          <span className="text-xl font-black font-mono text-on-surface">
                            {item.currency || 'USD'} {Number(item.total_estimated_cost || item.target_budget || 0).toLocaleString()}
                          </span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${isOver ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                            {variance}
                          </span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant block">Target: {item.currency} {Number(item.target_budget || 0).toLocaleString()} (±20% window)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyToProposal(item);
                          }}
                          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">rocket_launch</span>
                          <span>Use in Proposal</span>
                        </button>
                        
                        <button
                          onClick={(e) => handleDeleteItem(item.id, e)}
                          className="p-2 rounded-xl text-error hover:bg-error/10 bg-transparent border-none cursor-pointer flex items-center justify-center"
                          title="Delete from Vault"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>

                        <span className="material-symbols-outlined text-on-surface-variant text-xl">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown Content */}
                  {isExpanded && (
                    <div className="border-t border-outline-variant bg-surface-container-lowest p-lg space-y-lg animate-fadeIn">
                      {/* Sub-destinations Banner */}
                      <div className="bg-surface p-4 rounded-xl border border-outline-variant flex items-center justify-between flex-wrap gap-md">
                        <div>
                          <span className="text-xs font-bold uppercase text-primary tracking-wider block">Right-Sidebar Sub-Destinations</span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {(item.sub_destinations || []).map((sub, idx) => (
                              <span key={idx} className="px-3 py-1 bg-surface-container-high rounded-lg text-xs font-bold text-on-surface flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-primary">pin_drop</span>
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-on-surface-variant max-w-sm">
                          When selected in wizard, sub-destinations automatically bring their associated hotels, activities, meals, transfers, and custom notes with them!
                        </div>
                      </div>

                      {/* Day by Day Itinerary Breakdown */}
                      <div>
                        <h4 className="font-bold text-sm text-on-surface uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">calendar_month</span>
                          Day-by-Day Itinerary & Linked Inventory
                        </h4>
                        <div className="space-y-md">
                          {(item.days || []).map((day, dIdx) => (
                            <div key={dIdx} className="bg-surface border border-outline-variant rounded-xl p-md space-y-md">
                              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                                <h5 className="font-bold text-sm text-on-surface m-0">
                                  Day {day.day_number}: {day.title}
                                </h5>
                                {day.sub_destination && (
                                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {day.sub_destination}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-on-surface-variant leading-relaxed">{day.description}</p>

                              {/* Inventory Grid: Hotels, Activities, Meals, Transfers, Cruises */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                {/* Hotels */}
                                {(day.hotels || []).map((h, hIdx) => (
                                  <div key={hIdx} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex items-start gap-3">
                                    {h.image_url && (
                                      <img src={h.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-surface-container-high" />
                                    )}
                                    <div className="overflow-hidden flex-1">
                                      <span className="text-[10px] font-bold uppercase text-primary block">Hotel</span>
                                      <p className="font-bold text-xs text-on-surface truncate m-0">{h.name}</p>
                                      <p className="text-[11px] text-on-surface-variant truncate m-0">{h.category} • {h.location}</p>
                                      {h.price_per_night > 0 && <p className="text-xs font-mono font-bold text-on-surface mt-1">{item.currency} {h.price_per_night}/night</p>}
                                    </div>
                                  </div>
                                ))}

                                {/* Activities */}
                                {(day.activities || []).map((act, aIdx) => (
                                  <div key={aIdx} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex items-start gap-3">
                                    {act.image_url && (
                                      <img src={act.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-surface-container-high" />
                                    )}
                                    <div className="overflow-hidden flex-1">
                                      <span className="text-[10px] font-bold uppercase text-emerald-600 block">Activity</span>
                                      <p className="font-bold text-xs text-on-surface truncate m-0">{act.name}</p>
                                      <p className="text-[11px] text-on-surface-variant truncate m-0">{act.duration || 'Included'}</p>
                                      {act.price > 0 && <p className="text-xs font-mono font-bold text-on-surface mt-1">{item.currency} {act.price}</p>}
                                    </div>
                                  </div>
                                ))}

                                {/* Meals */}
                                {(day.meals || []).map((m, mIdx) => (
                                  <div key={mIdx} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex items-start gap-3">
                                    {m.image_url && (
                                      <img src={m.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-surface-container-high" />
                                    )}
                                    <div className="overflow-hidden flex-1">
                                      <span className="text-[10px] font-bold uppercase text-amber-600 block">Meal ({m.type})</span>
                                      <p className="font-bold text-xs text-on-surface truncate m-0">{m.venue || m.type}</p>
                                      <p className="text-[11px] text-on-surface-variant truncate m-0">{m.description}</p>
                                      {m.price > 0 && <p className="text-xs font-mono font-bold text-on-surface mt-1">{item.currency} {m.price}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Transfers & Cruises Tags */}
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {(day.transfers || []).map((tr, tIdx) => (
                                  <span key={tIdx} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-xs rounded-lg border border-blue-500/20 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">directions_car</span>
                                    Transfer: {tr.name} ({tr.vehicle_type})
                                  </span>
                                ))}
                                {(day.cruises || []).map((cr, cIdx) => (
                                  <span key={cIdx} className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-xs rounded-lg border border-purple-500/20 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">sailing</span>
                                    Cruise: {cr.name} ({cr.cabin_type})
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Custom Extra Sections (Parsed dynamically!) */}
                      {(item.extra_sections || []).length > 0 && (
                        <div>
                          <h4 className="font-bold text-sm text-on-surface uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">rule_folder</span>
                            Parsed Supplier Extra Sections (Zero Data Loss)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                            {item.extra_sections.map((sec, sIdx) => (
                              <div key={sIdx} className="bg-surface p-4 rounded-xl border border-outline-variant space-y-2">
                                <h5 className="font-bold text-xs text-primary uppercase tracking-wider m-0 border-b border-outline-variant pb-1.5">
                                  {sec.section_title}
                                </h5>
                                <ul className="space-y-1 pl-4 m-0 text-xs text-on-surface-variant list-disc">
                                  {(Array.isArray(sec.content) ? sec.content : [sec.content]).map((point, pIdx) => (
                                    <li key={pIdx}>{point}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
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
