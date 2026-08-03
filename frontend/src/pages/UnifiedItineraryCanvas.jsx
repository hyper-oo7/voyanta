import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProposalStore } from '../store/proposalStore.js';
import QuickIntakeModal from '../components/canvas/QuickIntakeModal.jsx';
import TemplateGalleryModal from '../components/canvas/TemplateGalleryModal.jsx';
import TemplateRenderer from '../components/TemplateRenderer.jsx';
import { Step2Itinerary } from './wizard/Step2Itinerary.jsx';
import PDFUploader from '../components/PDFUploader.jsx';
import RAGQueryPanel from '../components/RAGQueryPanel.jsx';
import { executeRAGQuery } from '../services/api.js';
import AIProposalChatDrawer from '../components/canvas/AIProposalChatDrawer.jsx';

export default function UnifiedItineraryCanvas() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const {
    proposal, client, branding, costingPrefs, viewMode, setViewMode,
    showTemplateGallery, setShowTemplateGallery,
    showQuickIntake, setShowQuickIntake,
    activeTemplateSlug, setTemplateSlug,
    setClient, setCostingPrefs, updateProposal, loadProposal
  } = useProposalStore();

  const [activeTab, setActiveTab] = useState('proposal');
  const [showRAGDrawer, setShowRAGDrawer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [ragActiveTab, setRagActiveTab] = useState('query');
  const [selectedSubDestinations, setSelectedSubDestinations] = useState([]);

  const p = proposal || {};
  const currentClient = client || {};

  // Unify days location since UI stores it in p.itinerary.days and AI generates in p.days
  const daysList = p.itinerary?.days || p.days || [];

  // Check if proposal actually has itinerary days or items (a real plan)
  const hasPlanContent = Boolean(
    (daysList && daysList.length > 0) || 
    (p.items && p.items.length > 0)
  );

  // Dynamic Costing & Margins Calculation (No Hardcoded Fractions)
  const marginType = costingPrefs.margin_type || 'percentage';
  const marginVal = Number(costingPrefs.pct_markup !== undefined ? costingPrefs.pct_markup : (costingPrefs.margin_value || 15));
  const taxRate = Number(costingPrefs.tax !== undefined ? costingPrefs.tax : 5);
  const discountVal = Number(costingPrefs.discount || 0);

  const itemSum = (p.items || []).reduce((acc, item) => acc + (Number(item.qty || 1) * Number(item.unit_price || item.price || 0)), 0);

  const dayBlockSum = daysList.reduce((dayAcc, day) => {
    let dayTotal = 0;
    if (day.hotels) {
      dayTotal += day.hotels.reduce((hAcc, h) => hAcc + (Number(h.price_per_night || h.price || 0) * (Number(h.nights || 1))), 0);
    }
    if (day.activities) {
      dayTotal += day.activities.reduce((aAcc, a) => aAcc + Number(a.price || 0), 0);
    }
    if (day.transfers) {
      dayTotal += day.transfers.reduce((tAcc, t) => tAcc + Number(t.price || 0), 0);
    }
    return dayAcc + dayTotal;
  }, 0);

  let subtotal = itemSum + dayBlockSum;
  let marginAmount = 0;
  let taxAmount = 0;
  let computedFinalTotal = 0;

  if (hasPlanContent && subtotal > 0) {
    marginAmount = marginType === 'percentage' ? subtotal * (marginVal / 100) : marginVal;
    const grossAmount = subtotal + marginAmount;
    taxAmount = grossAmount * (taxRate / 100);
    computedFinalTotal = Math.max(0, (grossAmount + taxAmount) - discountVal);
  }

  // For display purposes at the top header
  const finalTotal = computedFinalTotal;
  const pricePerPerson = finalTotal > 0 ? Math.round(finalTotal / (Number(p.num_travelers) || 2)) : 0;


  const [subDestCandidates, setSubDestCandidates] = useState([]);
  const [isGeneratingDay, setIsGeneratingDay] = useState(false);

  useEffect(() => {
    const fetchVaultSubDestinations = async () => {
      try {
        const res = await fetch('/api/vault/sub-destinations', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('voyanta_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.sub_destinations) {
            setSubDestCandidates(data.sub_destinations);
          }
        }
      } catch (err) {
        console.error('Failed to fetch vault sub-destinations:', err);
      }
    };
    fetchVaultSubDestinations();
  }, []);

  // Hydrate from AI Quick Generate if ai_generated=1
  useEffect(() => {
    if (params.get('ai_generated') === '1') {
      try {
        const generatedRaw = localStorage.getItem('voyanta_ai_generated_proposal');
        if (generatedRaw) {
          const parsed = JSON.parse(generatedRaw);
          if (parsed.proposal) {
            const nextClient = {
              ...client,
              customer_name: parsed.form?.client_name || 'Valued Traveler',
              destination: parsed.proposal.destination || parsed.form?.destination,
              duration_days: parsed.proposal.duration_days || parsed.form?.duration_days,
              budget: parsed.form?.budget_per_head || '',
              tour_type: parsed.form?.group_type || 'friends',
              pace: parsed.form?.pace || 'balanced',
              num_adults: parsed.form?.num_travelers || 2,
              special_notes: parsed.form?.preferences_text || ''
            };
            
            useProposalStore.setState({
              proposal: parsed.proposal,
              items: parsed.items || [],
              client: nextClient,
              activeTemplateSlug: parsed.proposal.template_style || 'classic'
            });
            
            // Default to Step 4 (Itinerary) or Wizard's active step if set
            const requestedStep = params.get('step');
            if (requestedStep === '4') {
              setActiveTab('itinerary');
            }
            
            // Clean up to avoid re-hydration issues on reload (optional, but safe)
            localStorage.removeItem('voyanta_ai_generated_proposal');
          }
        }
      } catch (err) {
        console.error('Failed to hydrate AI generated proposal:', err);
      }
    } else {
      const id = params.get('id');
      if (id && id !== proposal?.id) {
        loadProposal(id).catch(console.error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('id'), params.get('ai_generated')]);

  const handleAddSubDestination = async (subDest) => {
    const name = typeof subDest === 'string' ? subDest : subDest.name;
    if (selectedSubDestinations.includes(name)) return;
    
    const nextSubs = [...selectedSubDestinations, name];
    setSelectedSubDestinations(nextSubs);
    setIsGeneratingDay(true);

    try {
      const res = await fetch('/api/generate-day-module', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('voyanta_token')}`
        },
        body: JSON.stringify({ sub_destination: name })
      });
      
      const newDayNum = (p.days || []).length + 1;
      let newDay = null;
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.day_module) {
          newDay = { ...data.day_module, day_number: newDayNum };
        }
      }
      
      if (!newDay) {
        throw new Error('Failed to generate day');
      }

      updateProposal({
        ...p,
        days: [...(p.days || []), newDay]
      });
    } catch (err) {
      console.error('Failed to generate AI day block:', err);
      // Fallback
      const newDayNum = (p.days || []).length + 1;
      const newDay = {
        day_number: newDayNum,
        title: `Day ${newDayNum}: Excursion to ${name}`,
        description: `Explore key attractions, scenic spots, and local experiences in ${name}.`,
        sub_destination: name,
        activities: [{ name: `${name} Sightseeing & Local Walk`, timing: '10:00 AM' }]
      };
      updateProposal({
        ...p,
        days: [...(p.days || []), newDay]
      });
    } finally {
      setIsGeneratingDay(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body relative">
      {/* ─── Fixed Left Vertical RAG Tab Button ───────────────────────────── */}
      <button
        onClick={() => setShowRAGDrawer(!showRAGDrawer)}
        className="fixed left-0 top-1/3 z-40 px-2 py-4 bg-primary text-on-primary font-bold text-xs rounded-r-2xl shadow-xl flex flex-col items-center gap-2 hover:bg-primary/90 transition-all border-y border-r border-outline-variant"
        title="Open AI RAG Knowledge Base & Supplier PDF Vault"
      >
        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
        <span className="[writing-mode:vertical-lr] tracking-widest uppercase text-[11px]">RAG Vault</span>
      </button>

      {/* ─── Top Canvas Toolbar Bar ───────────────────────────────────────── */}
      <header className="bg-surface-container-high/90 backdrop-blur-md border-b border-outline-variant px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Trip Title & Client Meta */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/proposals')}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-headline text-on-surface line-clamp-1">
                {p.destination || 'Custom Proposal'} — {currentClient.customer_name || 'Valued Traveler'}
              </h1>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-md uppercase">
                {p.duration_days || (p.days || []).length || 3} Days
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Full Budget: ₹{finalTotal.toLocaleString()} · ₹{pricePerPerson.toLocaleString()}/head
            </p>
          </div>
        </div>

        {/* Center: Proposal vs Preview View Switcher, 1-Shot Intake, Template Gallery */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('proposal')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'proposal'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              Proposal
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              Preview
            </button>
          </div>

          <div className="flex items-center p-0.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium">
            <button
              onClick={() => setCostingPrefs({ ...costingPrefs, visibility_mode: 'ITEMIZED' })}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                costingPrefs.visibility_mode !== 'TOTAL_ONLY'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Itemized
            </button>
            <button
              onClick={() => setCostingPrefs({ ...costingPrefs, visibility_mode: 'TOTAL_ONLY' })}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                costingPrefs.visibility_mode === 'TOTAL_ONLY'
                  ? 'bg-surface text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Total Only
            </button>
          </div>

          <button
            onClick={() => setShowQuickIntake(true)}
            className="px-3 py-1.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            1-Shot Quick Intake
          </button>

          <button
            onClick={() => setShowTemplateGallery(true)}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-xl border border-outline-variant transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">palette</span>
            <span>Theme: <strong>{(activeTemplateSlug || 'classic').toUpperCase()}</strong></span>
            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">96</span>
          </button>
        </div>

        {/* Right: Web View Studio & Print PDF */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const token = p.share_token || p.id || 'demo';
              window.open(`/view/${token}`, '_blank');
            }}
            className="px-3 py-1.5 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Open Web View Studio
          </button>

          <button
            onClick={() => {
              const token = p.share_token || p.id || 'demo';
              const clientUrl = `${window.location.origin}/view/${token}?mode=client`;
              navigator.clipboard.writeText(clientUrl);
              alert('Copied Client Web Link to clipboard!\nSend this link to your client: ' + clientUrl);
            }}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-on-surface border border-outline-variant text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">link</span>
            Copy Client Link
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-surface-container hover:bg-surface-container-highest text-on-surface rounded-xl border border-outline-variant transition-colors"
            title="Download / Print PDF"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
        </div>
      </header>

      {/* ─── Main Canvas Editor Container ────────────────────────────────────────── */}
      <main className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'proposal' ? (
            <motion.div
              key="proposal-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              {/* Section 1: Client & Trip Parameters Card with Sub-Destination Auto-Fill */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person</span> Client & Trip Parameters
                  </h3>
                  <span className="text-xs text-primary font-semibold">1-Shot Editable</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-on-surface-variant mb-1">Client Name</label>
                    <input
                      type="text"
                      value={currentClient.customer_name}
                      onChange={(e) => setClient({ customer_name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-on-surface-variant mb-1">Destination</label>
                    <input
                      type="text"
                      value={currentClient.destination}
                      onChange={(e) => {
                        setClient({ destination: e.target.value });
                        updateProposal({ ...p, destination: e.target.value });
                      }}
                      placeholder="e.g. Himachal Pradesh, Manali, Kerala"
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-on-surface-variant mb-1">Target Budget (₹)</label>
                    <input
                      type="number"
                      value={currentClient.budget}
                      onChange={(e) => {
                        const newBudget = e.target.value;
                        setClient({ budget: newBudget });
                        // Update the proposal total if the budget changes directly to keep them in sync for estimates
                        updateProposal({ ...p, total_price: Number(newBudget) || p.total_price });
                      }}
                      placeholder="e.g. 50000"
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface font-semibold"
                    />
                  </div>
                </div>

                {/* Sub-Destinations Auto-Fill Options Extracted from Vault PDFs */}
                <div className="p-3.5 bg-surface border border-outline-variant/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[16px]">location_city</span>
                      ✨ Sub-destinations Extracted from Vault PDFs:
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {isGeneratingDay ? 'Generating day module with AI...' : 'Click pill to add to itinerary'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {subDestCandidates.length > 0 ? (
                      subDestCandidates.map((sd) => {
                        const sdName = typeof sd === 'string' ? sd : sd.name;
                        const isAdded = selectedSubDestinations.includes(sdName);
                        return (
                          <button
                            key={sdName}
                            type="button"
                            disabled={isAdded || isGeneratingDay}
                            onClick={() => handleAddSubDestination(sd)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border ${
                              isAdded
                                ? 'bg-primary-container text-on-primary-container border-primary opacity-50'
                                : 'bg-surface border-outline-variant text-on-surface hover:border-primary hover:text-primary'
                            }`}
                          >
                            {isAdded ? <span className="material-symbols-outlined text-[14px]">check</span> : <span className="material-symbols-outlined text-[14px]">add</span>}
                            <span>{sdName}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-xs text-on-surface-variant italic">
                        Type a destination above (e.g. Manali, Himachal, Kerala) to extract sub-destinations from Vault PDFs.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Rich WYSIWYG Day-by-Day Itinerary Editor */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">edit_note</span> Rich WYSIWYG Itinerary Editor
                  </h3>
                  <span className="text-xs text-primary font-semibold">Block Drag-and-Drop Enabled</span>
                </div>

                <Step2Itinerary
                  proposal={p}
                  setProposal={(upd) => {
                    const nextP = typeof upd === 'function' ? upd(p) : { ...p, ...upd };
                    updateProposal(nextP);
                  }}
                  items={p.items || []}
                  setItems={() => {}}
                  addItemsOptimistic={() => {}}
                  saveDraft={() => {}}
                />
              </div>

              {/* Section 3: Costing & Margins */}
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold font-headline text-lg text-on-surface flex items-center gap-2 m-0">
                    <span className="material-symbols-outlined text-primary">payments</span> Full-Budget Costing & Margins
                  </h3>
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {costingPrefs.visibility_mode || 'ITEMIZED'}
                  </span>
                </div>

                {/* Interactive Costing Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface rounded-xl border border-outline-variant/60 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Agency Margin ({costingPrefs.margin_type === 'flat' ? '₹' : '%'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={costingPrefs.pct_markup !== undefined ? costingPrefs.pct_markup : (costingPrefs.margin_value || 15)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCostingPrefs({ ...costingPrefs, pct_markup: val, margin_value: val });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container text-xs font-bold text-primary outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      GST / Taxes (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={costingPrefs.tax !== undefined ? costingPrefs.tax : 5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCostingPrefs({ ...costingPrefs, tax: val });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container text-xs font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      Visibility Mode
                    </label>
                    <select
                      value={costingPrefs.visibility_mode || 'ITEMIZED'}
                      onChange={(e) => setCostingPrefs({ ...costingPrefs, visibility_mode: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container text-xs font-bold text-on-surface outline-none"
                    >
                      <option value="ITEMIZED">ITEMIZED (Show Breakdown)</option>
                      <option value="TOTAL_ONLY">TOTAL_ONLY (Hide Breakdown)</option>
                      <option value="HIDDEN">HIDDEN (No Pricing)</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Costing Breakdown Display */}
                {costingPrefs.visibility_mode === 'HIDDEN' ? (
                  <div className="p-5 bg-surface border border-outline-variant/80 rounded-xl text-center text-xs text-on-surface-variant space-y-1.5">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant/40 block">visibility_off</span>
                    <p className="font-bold text-on-surface text-sm m-0">Pricing & Costing Hidden from Client</p>
                    <p className="text-[11px] text-on-surface-variant m-0">
                      Visibility mode is set to <strong>HIDDEN</strong>. Costing breakdown and totals are concealed in client web studio & PDF proposal exports.
                    </p>
                  </div>
                ) : !hasPlanContent || computedFinalTotal <= 0 ? (
                  <div className="p-5 bg-surface border border-outline-variant/80 rounded-xl text-center text-xs text-on-surface-variant space-y-1.5">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant/40 block">payments</span>
                    <p className="font-bold text-on-surface text-sm m-0">No Itinerary Days or Plan Items Added Yet</p>
                    <p className="text-[11px] text-on-surface-variant m-0">
                      Add day blocks above or click "1-Shot Quick Intake" to generate a complete itinerary plan with costing.
                    </p>
                  </div>
                ) : costingPrefs.visibility_mode === 'TOTAL_ONLY' ? (
                  <div className="p-4 bg-surface border border-outline-variant rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-sm font-bold text-primary">
                      <span>Final Client Package Total:</span>
                      <span className="text-base">₹{Math.round(computedFinalTotal).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant m-0 border-t border-outline-variant/30 pt-2">
                      Inclusive of all accommodations, transfers, activities, and taxes. Itemized subtotal breakdown hidden per TOTAL_ONLY setting.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-surface border border-outline-variant rounded-xl space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-outline-variant/30">
                      <span className="text-on-surface-variant">Net Trip Subtotal (Hotels + Transfers + Activities):</span>
                      <span className="font-bold text-on-surface">₹{Math.round(subtotal).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-outline-variant/30">
                      <span className="text-on-surface-variant">Agency Margin ({marginVal}{marginType === 'percentage' ? '%' : ' Flat'}):</span>
                      <span className="font-bold text-primary">+₹{Math.round(marginAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-outline-variant/30">
                      <span className="text-on-surface-variant">GST / Taxes ({taxRate}%):</span>
                      <span className="font-bold text-on-surface">+₹{Math.round(taxAmount).toLocaleString('en-IN')}</span>
                    </div>
                    {discountVal > 0 && (
                      <div className="flex justify-between py-1 border-b border-outline-variant/30">
                        <span className="text-on-surface-variant">Special Discount:</span>
                        <span className="font-bold text-emerald-500">-₹{Math.round(discountVal).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 text-sm font-bold text-primary">
                      <span>Final Client Package Total:</span>
                      <span>₹{Math.round(computedFinalTotal).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto w-full"
            >
              <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[calc(100vh-140px)]">
                <div className="px-5 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between text-xs">
                  <span className="font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                    Layout Preview: <strong className="text-on-surface">{(activeTemplateSlug || 'classic').toUpperCase()}</strong>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const token = p.share_token || p.id || 'demo';
                        window.open(`/view/${token}`, '_blank');
                      }}
                      className="text-primary hover:underline font-bold text-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      Open Web View Studio
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-6 bg-surface-container-lowest overflow-y-auto">
                  <TemplateRenderer 
                    style={activeTemplateSlug || 'classic'}
                    data={{
                      proposal: p,
                      totals: { subtotal: finalTotal, currency: 'INR' },
                      items_by_kind: {}
                    }}
                    branding={branding}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Phase 5A: AI Proposal Chat FAB and Drawer */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed right-6 bottom-6 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-accent text-on-primary shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-40 group"
        title="Chat with AI Curator"
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-12 transition-transform">chat_bubble</span>
      </button>

      <AIProposalChatDrawer isOpen={showAIChat} onClose={() => setShowAIChat(false)} />

      {/* ─── Slide-Over RAG Vault & Search Drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {showRAGDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-surface-container-low border-l border-outline-variant h-full shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  <h2 className="font-bold text-base text-on-surface">RAG Knowledge Base & Supplier PDF Vault</h2>
                </div>
                <button
                  onClick={() => setShowRAGDrawer(false)}
                  className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="flex border-b border-outline-variant bg-surface px-4 gap-4 text-xs font-semibold">
                <button
                  onClick={() => setRagActiveTab('query')}
                  className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    ragActiveTab === 'query'
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">search</span>
                  Search Vector Knowledge Base
                </button>
                <button
                  onClick={() => setRagActiveTab('upload')}
                  className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    ragActiveTab === 'upload'
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  Upload & Index Supplier PDFs
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 p-6 overflow-y-auto bg-surface-container-lowest">
                {ragActiveTab === 'query' ? (
                  <RAGQueryPanel agencyId={branding?.agency_id || 'demo-agency'} />
                ) : (
                  <PDFUploader agencyId={branding?.agency_id || 'demo-agency'} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modals ────────────────────────────────────────────────────────── */}
      <QuickIntakeModal isOpen={showQuickIntake} onClose={() => setShowQuickIntake(false)} />
      <TemplateGalleryModal isOpen={showTemplateGallery} onClose={() => setShowTemplateGallery(false)} />
    </div>
  );
}
