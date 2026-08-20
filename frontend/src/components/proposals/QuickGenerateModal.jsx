import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProposalStore } from '../../store/proposalStore.js';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { getAgencyId } from '../../lib/supabaseClient.js';
import { createProposal } from '../../services/proposalService.js';
import ContactPicker from '../common/ContactPicker.jsx';

// ── India + popular international destinations ────────────────────────────────
const DESTINATIONS = [
  // Himachal Pradesh
  'Manali', 'Shimla', 'Dharamshala', 'McLeod Ganj', 'Kasauli', 'Spiti Valley', 'Kinnaur', 'Dalhousie', 'Chail', 'Kufri',
  // Uttarakhand
  'Rishikesh', 'Haridwar', 'Mussoorie', 'Nainital', 'Jim Corbett', 'Auli', 'Chopta', 'Lansdowne',
  // Jammu & Kashmir
  'Kashmir', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Leh', 'Ladakh', 'Zanskar', 'Nubra Valley',
  // Rajasthan
  'Jaipur', 'Jodhpur', 'Udaipur', 'Jaisalmer', 'Pushkar', 'Ranthambore', 'Bikaner', 'Ajmer', 'Mount Abu',
  // Goa
  'Goa', 'North Goa', 'South Goa', 'Panjim',
  // Kerala
  'Kerala', 'Munnar', 'Alleppey', 'Thekkady', 'Wayanad', 'Kovalam', 'Varkala', 'Kumarakom',
  // Karnataka
  'Coorg', 'Mysuru', 'Bangalore', 'Hampi', 'Chikmagalur', 'Kabini',
  // Tamil Nadu
  'Ooty', 'Kodaikanal', 'Chennai', 'Madurai', 'Pondicherry', 'Rameswaram',
  // Northeast
  'Shillong', 'Meghalaya', 'Cherrapunji', 'Dawki', 'Kaziranga', 'Gangtok', 'Darjeeling', 'Sikkim', 'Tawang', 'Assam',
  // Andaman
  'Andaman', 'Port Blair', 'Havelock Island', 'Neil Island',
  // Maharashtra
  'Mumbai', 'Pune', 'Lonavala', 'Mahabaleshwar', 'Matheran', 'Alibaug',
  // Other India
  'Agra', 'Delhi', 'Varanasi', 'Amritsar', 'Kolkata', 'Hyderabad', 'Ahmedabad', 'Bhopal', 'Indore',
  // International
  'Bali', 'Thailand', 'Phuket', 'Bangkok', 'Singapore', 'Malaysia', 'Vietnam', 'Nepal', 'Bhutan', 'Sri Lanka',
  'Dubai', 'Abu Dhabi', 'Maldives', 'Mauritius', 'Seychelles', 'Istanbul', 'Paris', 'Rome', 'Europe',
];

const GROUP_TYPES = [
  { value: 'friends', label: '👥', name: 'Friends', desc: 'Fun & social vibe' },
  { value: 'couple', label: '💑', name: 'Couple', desc: 'Romantic' },
  { value: 'honeymoon', label: '💍', name: 'Honeymoon', desc: 'Luxury romance' },
  { value: 'family', label: '👨‍👩‍👧‍👦', name: 'Family', desc: 'Family-friendly' },
  { value: 'solo', label: '🧳', name: 'Solo', desc: 'Self-discovery' },
  { value: 'corporate', label: '💼', name: 'Corporate', desc: 'Business' },
];

const TRAVEL_STYLES = [
  { value: 'relaxed', label: '🌿', name: 'Relaxed' },
  { value: 'balanced', label: '⚖️', name: 'Balanced' },
  { value: 'adventure', label: '🏔️', name: 'Adventure' },
  { value: 'luxury', label: '✨', name: 'Luxury' },
  { value: 'budget', label: '💡', name: 'Budget' },
];

const PROGRESS_STEPS = [
  { icon: 'search', label: 'Searching your vault…' },
  { icon: 'hotel', label: 'Selecting best hotels…' },
  { icon: 'map', label: 'Building day-by-day itinerary…' },
  { icon: 'calculate', label: 'Calculating pricing & margins…' },
  { icon: 'auto_awesome', label: 'Finalizing your proposal…' },
];

export default function QuickGenerateModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { setClient, assemble1Shot, ragStatus, vaultStatus } = useProposalStore();

  const [form, setForm] = useState({
    destination: '',
    duration_days: 5,
    budget_per_head: 25000,
    group_type: 'friends',
    pace: 'balanced',
    client_name: '',
    num_travelers: 2,
    preferences_text: '',
    client_preferences: [],
    company_name: '',
    gstin: '',
    room_preference: 'single',
    requires_gst_invoice: false,
    single_room_supplement: false,
    meeting_room_required: false,
    early_checkin_required: false,
    late_checkout_required: false,
    corporate_cancellation_terms: false,
  });

  const [destQuery, setDestQuery] = useState('');
  const [showDestDrop, setShowDestDrop] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [done, setDone] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [vaultConfidence, setVaultConfidence] = useState(null);
  const [confidenceLoading, setConfidenceLoading] = useState(false);
  const destRef = useRef(null);

  // Phase 4: Fetch Destination Confidence dynamically
  useEffect(() => {
    if (!form.destination || form.destination.length < 3) {
      setVaultConfidence(null);
      setConfidenceLoading(false);
      return;
    }
    
    setConfidenceLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/vault/destination-confidence?destination=${encodeURIComponent(form.destination)}`, {
          signal: controller.signal
        });
        setVaultConfidence(res.data);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.message !== 'canceled' && err.code !== 'ERR_CANCELED') {
          setVaultConfidence({ confidence_score: 0, pdfs: 0, proposals: 0 });
        }
      } finally {
        if (!controller.signal.aborted) {
          setConfidenceLoading(false);
        }
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.destination]);

  useEffect(() => {
    if (isOpen) {
      setGenerating(false);
      setProgressStep(0);
      setDone(false);
      setPendingResult(null);
      setDestQuery(form.destination || '');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !generating) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, generating]);

  useEffect(() => {
    const handler = (e) => {
      if (destRef.current && !destRef.current.contains(e.target)) setShowDestDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDests = DESTINATIONS.filter(d =>
    d.toLowerCase().includes(destQuery.toLowerCase())
  ).slice(0, 10);

  const updateForm = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const finalizeAndNavigate = (proposal, createdProposalId, mergedPreferences) => {
    try {
      localStorage.setItem('voyanta_ai_generated_proposal', JSON.stringify({
        proposal,
        form,
        model_used: proposal.model_used || '1-Shot Assembly',
        generated_at: new Date().toISOString(),
      }));
    } catch {}

    if (typeof setClient === 'function') {
      setClient({
        customer_name: form.client_name || 'Valued Traveler',
        destination: proposal.destination || form.destination,
        duration_days: proposal.duration_days || form.duration_days,
        num_adults: Number(form.num_travelers),
        num_children: 0,
        special_notes: mergedPreferences,
        tour_type: form.group_type,
        pace: form.pace,
      });
    }

    const isRagAugmented = (proposal.model_used || '').includes('RAG');
    toast.success(`✨ Proposal generated!${isRagAugmented ? ' Powered by your vault.' : ''}`);
    onClose();

    const navUrl = createdProposalId
      ? `/proposals/wizard?step=4&ai_generated=1&id=${createdProposalId}`
      : `/proposals/wizard?step=4&ai_generated=1&destination=${encodeURIComponent(proposal.destination || form.destination)}`;
    navigate(navUrl);
  };

  const handleGenerate = async () => {
    if (!form.destination.trim()) {
      toast.warning('Please enter a destination first');
      return;
    }
    setGenerating(true);
    setProgressStep(0);

    try {
      let agencyId = 'global';
      try {
        agencyId = getAgencyId() || 'global';
      } catch (err) {
        agencyId = 'global';
      }

      const mergedPreferences = form.client_preferences && form.client_preferences.length > 0
        ? [form.client_preferences.join(', '), form.preferences_text].filter(Boolean).join(' | ')
        : (form.preferences_text || '');

      const payload = {
        destination: form.destination,
        duration_days: Number(form.duration_days),
        budget_per_head: Number(form.budget_per_head),
        group_type: form.group_type,
        pace: form.pace,
        client_name: form.client_name || 'Valued Traveler',
        num_travelers: Number(form.num_travelers),
        num_adults: Number(form.num_travelers),
        preferences_text: mergedPreferences,
        special_notes: mergedPreferences,
        company_name: form.company_name,
        gstin: form.gstin,
        room_preference: form.room_preference,
        requires_gst_invoice: form.requires_gst_invoice,
        single_room_supplement: form.single_room_supplement,
        meeting_room_required: form.meeting_room_required,
        early_checkin_required: form.early_checkin_required,
        late_checkout_required: form.late_checkout_required,
        corporate_cancellation_terms: form.corporate_cancellation_terms,
        agency_id: agencyId,
        costing_prefs: {
          fixed_markup: 0,
          pct_markup: 15,
          discount: 0,
          tax: 5,
          margin_type: 'percentage',
          margin_value: 15,
          visibility_mode: 'ITEMIZED',
        },
      };

      // Use global assemble1Shot to get RAG/Vault context and track statuses
      const proposal = await assemble1Shot(payload, (stepIdx) => {
        setProgressStep(stepIdx);
      });
      setProgressStep(PROGRESS_STEPS.length - 1);

      if (!proposal) throw new Error('No proposal returned from server');

      // Phase 4: Create draft proposal in database
      const newProposalPayload = {
        name: (form.client_name || 'AI Draft') + ' - ' + (proposal.destination || form.destination) + ' Trip',
        client_name: form.client_name || 'Valued Traveler',
        destination: proposal.destination || form.destination,
        travelers: Number(form.num_travelers),
        status: 'Draft',
        trip_details: proposal,
        currency: proposal.currency || 'INR',
        budget_min: Number(form.budget_per_head) * Number(form.num_travelers),
        budget_max: Number(form.budget_per_head) * Number(form.num_travelers)
      };
      
      let createdProposalId = '';
      try {
        const saved = await createProposal(newProposalPayload);
        if (saved && saved.id) {
          createdProposalId = saved.id;
        }
      } catch (err) {
        console.warn('[QuickGenerate] Failed to save draft proposal to DB, falling back to local.', err);
      }

      setDone(true);

      const currentRagStatus = useProposalStore.getState().ragStatus;
      const currentVaultStatus = useProposalStore.getState().vaultStatus;

      if (currentRagStatus !== 'ok' || currentVaultStatus !== 'ok') {
        setPendingResult({ proposal, createdProposalId, mergedPreferences });
        setGenerating(false);
        return;
      }

      await new Promise(r => setTimeout(r, 900));
      finalizeAndNavigate(proposal, createdProposalId, mergedPreferences);

    } catch (err) {
      console.error('[QuickGenerate]', err);
      toast.error(err?.response?.data?.detail || err?.message || 'Generation failed. Please try again.');
      setGenerating(false);
      setProgressStep(0);
      setDone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !generating) onClose(); }}
    >
      <style>{`
        @keyframes qgSlideUp {
          from { opacity:0; transform:translateY(28px) scale(0.96); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes qgSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes qgPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(139,92,246,0.4); }
          50% { box-shadow:0 0 0 14px rgba(139,92,246,0); }
        }
        @keyframes qgCheck { 0%{transform:scale(0)} 60%{transform:scale(1.25)} 100%{transform:scale(1)} }
        @keyframes qgStep { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        .qg-chip-on { background:rgba(124,58,237,0.25); border-color:rgba(124,58,237,0.75); color:#c4b5fd; }
        .qg-chip-off { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1); color:rgba(255,255,255,0.65); }
        .qg-chip-off:hover { border-color:rgba(124,58,237,0.4); }
        .qg-btn { background:linear-gradient(135deg,#7c3aed,#4f46e5,#7c3aed); background-size:200% auto; transition:all .3s ease; }
        .qg-btn:hover:not(:disabled) { background-position:right center; box-shadow:0 8px 28px rgba(124,58,237,0.5); transform:translateY(-1px); }
        .qg-btn:active:not(:disabled) { transform:translateY(0); }
        .qg-dest-drop { background:#1a1a2e; border:1px solid rgba(139,92,246,0.3); border-radius:12px; }
        .qg-input { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); color:#fff; }
        .qg-input:focus { outline:none; border-color:rgba(124,58,237,0.6); box-shadow:0 0 12px rgba(124,58,237,0.12); }
        .qg-input::placeholder { color:rgba(255,255,255,0.28); }
        .qg-range { appearance:none; height:5px; border-radius:9999px; cursor:pointer; }
        .qg-range::-webkit-slider-thumb { appearance:none; width:18px; height:18px; border-radius:50%; background:#7c3aed; cursor:pointer; box-shadow:0 0 8px rgba(124,58,237,0.5); }
      `}</style>

      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
        style={{
          background: 'linear-gradient(145deg,#0d0d1a 0%,#1a1a2e 55%,#16213e 100%)',
          border: '1px solid rgba(139,92,246,0.28)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.85),0 0 50px rgba(139,92,246,0.12)',
          animation: 'qgSlideUp .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {/* Header */}
        <div className="px-8 pt-7 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  boxShadow: '0 0 18px rgba(124,58,237,0.5)',
                  animation: generating ? 'qgPulse 1.5s infinite' : 'none',
                }}
              >
                <span className="material-symbols-outlined text-white text-[22px]"
                  style={{ animation: generating ? 'qgSpin 2.5s linear infinite' : 'none' }}>
                  auto_awesome
                </span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-white m-0 leading-tight">AI Quick Generate</h2>
                <p className="text-xs text-purple-300/60 m-0 mt-0.5">Build a complete proposal from your vault in seconds</p>
              </div>
            </div>
            {!generating && (
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border-none bg-transparent cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        </div>

        {(generating || done) && (
          <div className="px-8 py-14 flex flex-col items-center gap-8">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: done ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  boxShadow: done ? '0 0 40px rgba(34,197,94,0.5)' : '0 0 40px rgba(124,58,237,0.5)',
                  animation: done ? 'none' : 'qgPulse 1.5s infinite',
                  transition: 'all 0.5s ease',
                }}
              >
                {done ? (
                  <span className="material-symbols-outlined text-white text-[50px]" style={{ animation: 'qgCheck .5s ease' }}>check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-white text-[50px]" style={{ animation: 'qgSpin 2s linear infinite' }}>auto_awesome</span>
                )}
              </div>
              {!done && (
                <div className="absolute inset-0 rounded-full"
                  style={{ border: '2px solid transparent', borderTopColor: 'rgba(139,92,246,0.7)', animation: 'qgSpin 1s linear infinite' }} />
              )}
            </div>

            <div className="w-full max-w-xs flex flex-col gap-3">
              {PROGRESS_STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 transition-all duration-500"
                  style={{
                    opacity: idx <= progressStep ? 1 : 0.2,
                    transform: idx === progressStep && !done ? 'scale(1.04)' : 'scale(1)',
                    animation: idx === progressStep ? 'qgStep .4s ease' : 'none',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                    style={{
                      background: done || idx < progressStep
                        ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                        : idx === progressStep
                          ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                          : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="material-symbols-outlined text-white text-[13px]">
                      {done || idx < progressStep ? 'check' : step.icon}
                    </span>
                  </div>
                  <span className="text-sm font-medium" style={{
                    color: idx === progressStep && !done ? '#c4b5fd' : (idx < progressStep || done) ? '#86efac' : 'rgba(255,255,255,0.35)',
                  }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {done && !pendingResult && (
              <p className="text-green-400 font-semibold text-center m-0" style={{ animation: 'qgPulse 1s ease infinite' }}>
                ✨ Proposal ready! Redirecting to wizard…
              </p>
            )}

            {done && pendingResult && (
              <div className="w-full flex flex-col gap-3">
                <p className="text-green-400 font-semibold text-center m-0">
                  ✨ Proposal ready — with a few caveats
                </p>

                {vaultStatus !== 'ok' && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(234,179,8,0.09)', border: '1px solid rgba(234,179,8,0.22)' }}>
                    <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 text-yellow-400">inventory_2</span>
                    <p className="text-[11px] m-0 flex-1 leading-relaxed text-yellow-200/80">
                      <strong className="text-yellow-300">No vault inventory matched {form.destination}.</strong> This draft uses curated baseline rates instead of your supplier pricing. Upload a supplier PDF for this destination to ground future drafts.
                    </p>
                  </div>
                )}

                {ragStatus !== 'ok' && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(234,179,8,0.09)', border: '1px solid rgba(234,179,8,0.22)' }}>
                    <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 text-yellow-400">
                      {ragStatus === 'degraded' ? 'cloud_off' : 'description'}
                    </span>
                    <p className="text-[11px] m-0 flex-1 leading-relaxed text-yellow-200/80">
                      {ragStatus === 'degraded'
                        ? <><strong className="text-yellow-300">Document search was unavailable.</strong> The draft was built without context from your uploaded documents.</>
                        : <><strong className="text-yellow-300">No matching documents found.</strong> Descriptions are generated rather than sourced from your uploaded documents.</>}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => finalizeAndNavigate(pendingResult.proposal, pendingResult.createdProposalId, pendingResult.mergedPreferences)}
                  className="qg-btn w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 border-none cursor-pointer"
                >
                  Continue to wizard
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {!generating && !done && (
          <div className="px-8 py-7 flex flex-col gap-6">

            {/* Destination */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Destination *</label>
              <div className="relative" ref={destRef}>
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 text-[20px] pointer-events-none">location_on</span>
                <input
                  type="text"
                  value={destQuery}
                  onChange={e => { setDestQuery(e.target.value); updateForm('destination', e.target.value); setShowDestDrop(true); }}
                  onFocus={() => setShowDestDrop(true)}
                  placeholder="Search — Manali, Kashmir, Bali…"
                  className="qg-input w-full pl-11 pr-4 py-3.5 text-sm rounded-xl"
                  style={{ border: `1px solid ${form.destination ? 'rgba(124,58,237,0.65)' : 'rgba(255,255,255,0.12)'}` }}
                />
                {showDestDrop && filteredDests.length > 0 && (
                  <div className="qg-dest-drop absolute top-full left-0 right-0 mt-1.5 z-50 shadow-2xl max-h-52 overflow-y-auto">
                    {filteredDests.map(d => (
                      <button key={d} onClick={() => { updateForm('destination', d); setDestQuery(d); setShowDestDrop(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-white/75 hover:bg-purple-500/20 hover:text-white transition-colors border-none bg-transparent cursor-pointer flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400 text-[16px]">place</span>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Duration + Travelers */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'duration_days', label: 'Duration (Days)', min: 1, max: 30 },
                { key: 'num_travelers', label: 'Travelers', min: 1, max: 50 },
              ].map(({ key, label, min, max }) => (
                <div key={key} className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">{label}</label>
                  <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <button onClick={() => updateForm(key, Math.max(min, form[key] - 1))}
                      className="w-7 h-7 rounded-full bg-purple-500/30 text-white hover:bg-purple-500/50 transition-all border-none cursor-pointer text-xl flex items-center justify-center font-bold">−</button>
                    <span className="text-white font-bold text-lg flex-1 text-center">{form[key]}</span>
                    <button onClick={() => updateForm(key, Math.min(max, form[key] + 1))}
                      className="w-7 h-7 rounded-full bg-purple-500/30 text-white hover:bg-purple-500/50 transition-all border-none cursor-pointer text-xl flex items-center justify-center font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Budget Slider */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">
                Budget Per Person — <span className="text-purple-200 font-mono text-[13px]">₹{Number(form.budget_per_head).toLocaleString('en-IN')}</span>
              </label>
              <input
                type="range" min="5000" max="200000" step="2500"
                value={form.budget_per_head}
                onChange={e => updateForm('budget_per_head', Number(e.target.value))}
                className="qg-range w-full"
                style={{
                  background: `linear-gradient(to right,#7c3aed ${((form.budget_per_head - 5000) / 195000) * 100}%,rgba(255,255,255,0.13) ${((form.budget_per_head - 5000) / 195000) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-white/30 font-mono">
                <span>₹5K</span><span>₹50K</span><span>₹1L</span><span>₹2L</span>
              </div>
            </div>

            {/* Group Type */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Group Type</label>
              <div className="grid grid-cols-3 gap-2">
                {GROUP_TYPES.map(g => (
                  <button key={g.value} onClick={() => updateForm('group_type', g.value)}
                    className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${form.group_type === g.value ? 'qg-chip-on' : 'qg-chip-off'}`}>
                    <span className="text-xl">{g.label}</span>
                    <span className="text-[11px] font-semibold">{g.name}</span>
                    <span className="text-[9px] opacity-60">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Style */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Travel Style</label>
              <div className="grid grid-cols-5 gap-2">
                {TRAVEL_STYLES.map(s => (
                  <button key={s.value} onClick={() => updateForm('pace', s.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${form.pace === s.value ? 'qg-chip-on' : 'qg-chip-off'}`}>
                    <span className="text-lg">{s.label}</span>
                    <span className="text-[10px] font-semibold">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Corporate Panel */}
            {form.group_type === 'corporate' && (
              <div className="flex flex-col gap-4 p-4 rounded-xl border col-span-full"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(124,58,237,0.3)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-purple-400 text-lg">work</span>
                  <h4 className="m-0 text-sm font-semibold text-white">Corporate Details</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Company Name</label>
                    <input type="text" value={form.company_name} onChange={e => updateForm('company_name', e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg qg-input" placeholder="e.g. Acme Corp" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">GSTIN</label>
                    <input type="text" value={form.gstin} onChange={e => updateForm('gstin', e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg qg-input" placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Room Arrangement</label>
                  <div className="flex gap-2">
                    {['single', 'double', 'twin'].map(r => (
                      <button key={r} type="button" onClick={() => updateForm('room_preference', r)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border cursor-pointer ${form.room_preference === r ? 'qg-chip-on' : 'qg-chip-off'}`}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { key: 'requires_gst_invoice', label: 'GST Invoice' },
                    { key: 'single_room_supplement', label: 'Single Supplement' },
                    { key: 'meeting_room_required', label: 'Meeting Room' },
                    { key: 'early_checkin_required', label: 'Early Check-in' },
                    { key: 'late_checkout_required', label: 'Late Checkout' },
                    { key: 'corporate_cancellation_terms', label: 'Strict Cancellation' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                      <input type="checkbox" checked={form[opt.key]} onChange={e => updateForm(opt.key, e.target.checked)}
                        className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Client Name */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Client Name (Optional)</label>
                <ContactPicker
                  onSelect={(c) => {
                    updateForm('client_name', c.name || '');
                    
                    // Phase 4C: Auto-inject client preferences into context
                    if (c.preferences) {
                      const prefLines = [];
                      if (c.preferences.dietary) prefLines.push(`Diet: ${c.preferences.dietary}`);
                      if (c.preferences.pace) prefLines.push(`Pace: ${c.preferences.pace}`);
                      if (c.preferences.dislikes) prefLines.push(`Avoid: ${c.preferences.dislikes}`);
                      
                      if (prefLines.length > 0) {
                        updateForm('client_preferences', prefLines);
                        toast.success('Auto-applied client travel preferences!');
                      } else {
                        updateForm('client_preferences', []);
                      }
                    }
                  }}
                  variant="dark"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 text-[20px] pointer-events-none">person</span>
                <input type="text" value={form.client_name} onChange={e => updateForm('client_name', e.target.value)}
                  placeholder="e.g. Rahul Sharma" className="qg-input w-full pl-11 pr-4 py-3 text-sm rounded-xl" />
              </div>
            </div>

            {/* Preferences */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300/80">Special Preferences (Optional)</label>
              
              {form.client_preferences && form.client_preferences.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                  {form.client_preferences.map((pref, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 border border-purple-500/30 text-[11px] text-purple-200">
                      <span>{pref}</span>
                      <button 
                        onClick={() => updateForm('client_preferences', form.client_preferences.filter((_, idx) => idx !== i))}
                        className="bg-transparent border-none text-purple-400 hover:text-white cursor-pointer p-0 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea value={form.preferences_text} onChange={e => updateForm('preferences_text', e.target.value)}
                placeholder="e.g. No trekking, vegetarian meals, houseboat stay…"
                rows={2} className="qg-input w-full px-4 py-3 text-sm rounded-xl resize-none" />
            </div>

            {/* Vault note / Confidence Banner */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all"
              style={{ background: vaultConfidence?.pdfs > 0 && !confidenceLoading ? 'rgba(34,197,94,0.09)' : 'rgba(139,92,246,0.09)', border: `1px solid ${vaultConfidence?.pdfs > 0 && !confidenceLoading ? 'rgba(34,197,94,0.22)' : 'rgba(139,92,246,0.22)'}` }}>
              <span className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 ${confidenceLoading ? 'animate-spin text-purple-400' : (vaultConfidence?.pdfs > 0 ? 'text-green-400' : 'text-purple-400')}`}>
                {confidenceLoading ? 'sync' : (vaultConfidence?.pdfs > 0 ? 'check_circle' : 'bolt')}
              </span>
              <p className={`text-[11px] m-0 flex-1 leading-relaxed ${vaultConfidence?.pdfs > 0 && !confidenceLoading ? 'text-green-200/75' : 'text-purple-200/75'}`}>
                {confidenceLoading ? (
                  <span className="animate-pulse">Checking vault for destination insights...</span>
                ) : (
                  vaultConfidence?.pdfs > 0 ? (
                    <>
                      <strong className="text-green-300">✓ {vaultConfidence.pdfs} supplier {vaultConfidence.pdfs === 1 ? 'PDF' : 'PDFs'} found for {form.destination}.</strong> Voyanta will use authentic rates and descriptions from your vault for this draft.
                    </>
                  ) : (
                    <>
                      Voyanta searches your <strong className="text-purple-300">uploaded PDFs and library</strong> first. Falls back to curated baseline data for new destinations.
                    </>
                  )
                )}
              </p>
            </div>

            {/* CTA Button */}
            <button
              id="quick-generate-submit"
              onClick={handleGenerate}
              disabled={!form.destination.trim()}
              className="qg-btn w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 border-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              Generate Proposal with AI
              <span className="text-white/55 text-sm font-normal ml-1">~10 sec</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
