import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
import LogoUploader from '../components/LogoUploader.jsx';
import QuickGenerateModal from '../components/proposals/QuickGenerateModal.jsx';

const POPULAR_DESTINATIONS = ['Manali', 'Kashmir', 'Kerala', 'Goa', 'Rajasthan', 'Bali', 'Dubai', 'Maldives'];

const GROUP_TYPES = [
  { value: 'friends', label: '👥', name: 'Friends' },
  { value: 'couple', label: '💑', name: 'Couple' },
  { value: 'honeymoon', label: '💍', name: 'Honeymoon' },
  { value: 'family', label: '👨‍👩‍👧‍👦', name: 'Family' },
  { value: 'solo', label: '🧳', name: 'Solo' },
  { value: 'corporate', label: '💼', name: 'Corporate' },
];

const TRAVEL_STYLES = [
  { value: 'relaxed', label: '🌿', name: 'Relaxed' },
  { value: 'balanced', label: '⚖️', name: 'Balanced' },
  { value: 'adventure', label: '🏔️', name: 'Adventure' },
  { value: 'luxury', label: '✨', name: 'Luxury' },
  { value: 'budget', label: '💡', name: 'Budget' },
];

export default function NewItineraryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { costingPrefs } = useProposalStore();

  const [mode, setMode] = useState('blank'); // 'blank' | 'ai'
  const [saving, setSaving] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    country: '',
    state: '',
    city: '',
    duration: 5,
    theme: '',
    tags: '',
    description: '',
    cover_image: '',
    // AI Intake Fields
    client_name: '',
    budget_per_head: 25000,
    group_type: 'friends',
    pace: 'balanced',
    num_travelers: 2,
    preferences_text: '',
    num_children: 0,
    child_ages: [],
    hotel_category: '4_star',
    flight_class: 'economy',
    transport_type: 'private_car',
    dietary: '',
    budget_flexibility: 'strict',
    start_date: '',
    end_date: '',
    company_name: '',
    gstin: '',
    room_preference: 'double',
    requires_gst_invoice: false,
    single_room_supplement: false,
    early_checkin_required: false,
    late_checkout_required: false,
    meeting_room_required: false,
    corporate_cancellation_terms: false,
    margin: costingPrefs?.pct_markup || 15,
    tax: costingPrefs?.tax || 5,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCreateBlank = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Itinerary Name is required'); return; }
    setSaving(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

      const payload = {
        name: formData.name.trim(),
        destination: formData.destination.trim(),
        duration: formData.duration,
        description: formData.description.trim(),
        cover_image: formData.cover_image,
        country: formData.country.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        theme: formData.theme.trim(),
        tags: tagsArray,
      };

      const it = await itinerariesService.create(payload);
      
      const blocks = [];
      blocks.push({ itinerary_id: it.id, block_type: 'arrival', title: 'Arrival', position: 0, content: [] });
      for (let i = 1; i <= formData.duration; i++) {
        blocks.push({ itinerary_id: it.id, block_type: 'day', day_number: i, title: `Day ${i}`, position: i, content: [] });
      }
      blocks.push({ itinerary_id: it.id, block_type: 'departure', title: 'Departure', position: formData.duration + 1, content: [] });
      
      await Promise.all(blocks.map((b) => itineraryBlocksService.create(b)));
      
      toast.success('Itinerary created');
      navigate(`/itinerary/${it.id}`);
    } catch (err) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAiModal = (e) => {
    if (e) e.preventDefault();
    if (!formData.destination.trim()) {
      toast.warning('Please enter or select a Destination first');
      return;
    }
    setShowAiModal(true);
  };

  const aiInitialData = {
    ...formData,
    duration: formData.duration,
    client_name: formData.client_name || formData.name,
    preferences_text: formData.preferences_text || formData.description,
  };

  return (
    <div className="p-xl space-y-xl max-w-4xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div className="flex items-center gap-md">
          <button 
            onClick={() => navigate('/itinerary')}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="font-headline-md text-3xl font-bold text-on-surface m-0">Create New Itinerary</h2>
            <p className="font-body-lg text-on-surface-variant m-0 mt-xs">
              Choose manual block editor or generate with AI in seconds.
            </p>
          </div>
        </div>

        {/* Mode Toggle Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-outline-variant/60">
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              mode === 'blank'
                ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Create Blank Itinerary
          </button>

          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              mode === 'ai'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Generate with AI
          </button>
        </div>
      </div>

      {/* Mode 1: Blank Itinerary Form */}
      {mode === 'blank' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-xl shadow-sm border border-outline-variant space-y-xl">
          {/* AI Banner Suggestion */}
          <div className="flex items-center justify-between p-lg rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/5 border border-purple-500/20">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </div>
              <div>
                <h4 className="font-bold text-on-surface m-0 text-sm">Want AI to draft this automatically?</h4>
                <p className="text-xs text-on-surface-variant m-0 mt-0.5">Generate day-by-day plans, hotels, and authentic rates from your vault.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMode('ai')}
              className="px-lg py-sm bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Switch to AI
            </button>
          </div>

          <form onSubmit={handleCreateBlank} className="space-y-xl">
            <LogoUploader 
              value={formData.cover_image} 
              onChange={(v) => setFormData(s => ({ ...s, cover_image: v }))} 
              label="Cover Image" 
              testid="itin-cover" 
              folder="covers" 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <label className="flex flex-col gap-xs col-span-full">
                <span className="font-label-md text-on-surface font-semibold">Itinerary Name *</span>
                <input type="text" required value={formData.name} onChange={(e) => setFormData(s => ({ ...s, name: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Dubai Luxury 5D/4N" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Destination</span>
                <input type="text" value={formData.destination} onChange={(e) => setFormData(s => ({ ...s, destination: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Dubai" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Duration (Days)</span>
                <input type="number" min="1" max="90" value={formData.duration} onChange={(e) => setFormData(s => ({ ...s, duration: parseInt(e.target.value) || 1 }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Country</span>
                <input type="text" value={formData.country} onChange={(e) => setFormData(s => ({ ...s, country: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. United Arab Emirates" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">State / Region</span>
                <input type="text" value={formData.state} onChange={(e) => setFormData(s => ({ ...s, state: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Dubai Emirate" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">City</span>
                <input type="text" value={formData.city} onChange={(e) => setFormData(s => ({ ...s, city: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Dubai" />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Theme</span>
                <input type="text" value={formData.theme} onChange={(e) => setFormData(s => ({ ...s, theme: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Honeymoon, Adventure" />
              </label>

              <label className="flex flex-col gap-xs col-span-full">
                <span className="font-label-md text-on-surface font-semibold">Tags (comma separated)</span>
                <input type="text" value={formData.tags} onChange={(e) => setFormData(s => ({ ...s, tags: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all dark:bg-slate-800 dark:text-white" placeholder="e.g. Luxury, Summer, Couple" />
              </label>

              <label className="flex flex-col gap-xs col-span-full">
                <span className="font-label-md text-on-surface font-semibold">Description</span>
                <textarea value={formData.description} onChange={(e) => setFormData(s => ({ ...s, description: e.target.value }))} rows={4}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none dark:bg-slate-800 dark:text-white" placeholder="Brief overview of the experience..." />
              </label>
            </div>
            
            <div className="flex justify-end gap-md pt-lg border-t border-outline-variant/50">
              <button type="button" onClick={() => navigate('/itinerary')} className="px-xl py-md border border-outline-variant text-on-surface font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-xl py-md bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-colors shadow-md disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Blank Itinerary'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mode 2: AI Generation Intake Form */}
      {mode === 'ai' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-xl shadow-sm border border-purple-500/30 space-y-xl">
          <div className="flex items-center gap-md pb-md border-b border-outline-variant/40">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface m-0">AI Itinerary & Client Intake</h3>
              <p className="text-xs text-on-surface-variant m-0 mt-0.5">Specify destination, budget, and travel preferences to generate a tailored trip.</p>
            </div>
          </div>

          <form onSubmit={handleOpenAiModal} className="space-y-xl">
            {/* Destination */}
            <div className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Destination *</span>
              <input 
                type="text" 
                required 
                value={formData.destination} 
                onChange={(e) => setFormData(s => ({ ...s, destination: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition-all dark:bg-slate-800 dark:text-white" 
                placeholder="e.g. Kashmir, Manali, Bali, Dubai..." 
              />
              <div className="flex flex-wrap gap-xs mt-xs">
                <span className="text-xs text-on-surface-variant font-semibold self-center mr-xs">Popular:</span>
                {POPULAR_DESTINATIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFormData(s => ({ ...s, destination: d }))}
                    className={`px-sm py-xs rounded-lg text-xs font-semibold transition-all border ${
                      formData.destination.toLowerCase() === d.toLowerCase()
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-on-surface-variant border-transparent hover:border-purple-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Travelers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Duration (Days) *</span>
                <input 
                  type="number" 
                  min="1" 
                  max="30" 
                  required
                  value={formData.duration} 
                  onChange={(e) => setFormData(s => ({ ...s, duration: parseInt(e.target.value) || 1 }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition-all dark:bg-slate-800 dark:text-white" 
                />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Travelers</span>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={formData.num_travelers} 
                  onChange={(e) => setFormData(s => ({ ...s, num_travelers: parseInt(e.target.value) || 1 }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition-all dark:bg-slate-800 dark:text-white" 
                />
              </label>

              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-on-surface font-semibold">Client Name (Optional)</span>
                <input 
                  type="text" 
                  value={formData.client_name} 
                  onChange={(e) => setFormData(s => ({ ...s, client_name: e.target.value }))}
                  className="px-md py-md border border-outline-variant rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition-all dark:bg-slate-800 dark:text-white" 
                  placeholder="e.g. Rahul Sharma" 
                />
              </label>
            </div>

            {/* Budget Per Head Slider */}
            <div className="flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <span className="font-label-md text-on-surface font-semibold">Budget Per Person</span>
                <span className="text-purple-600 dark:text-purple-400 font-bold font-mono text-sm">
                  ₹{Number(formData.budget_per_head).toLocaleString('en-IN')}
                </span>
              </div>
              <input 
                type="range" 
                min="5000" 
                max="200000" 
                step="2500" 
                value={formData.budget_per_head}
                onChange={(e) => setFormData(s => ({ ...s, budget_per_head: Number(e.target.value) }))}
                className="w-full accent-purple-600 cursor-pointer" 
              />
              <div className="flex justify-between text-xs text-on-surface-variant font-mono">
                <span>₹5K</span><span>₹50K</span><span>₹1L</span><span>₹2L</span>
              </div>
            </div>

            {/* Group Type */}
            <div className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Group Type</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-xs">
                {GROUP_TYPES.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setFormData(s => ({ ...s, group_type: g.value }))}
                    className={`flex flex-col items-center gap-1 p-xs rounded-xl border text-center transition-all ${
                      formData.group_type === g.value
                        ? 'bg-purple-500/10 border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                        : 'border-outline-variant/60 text-on-surface-variant hover:border-purple-300'
                    }`}
                  >
                    <span className="text-lg">{g.label}</span>
                    <span className="text-xs">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Corporate Panel */}
            {formData.group_type === 'corporate' && (
              <div className="flex flex-col gap-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-lg">work</span>
                  <h4 className="m-0 text-sm font-semibold text-on-surface">Corporate Details</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Company Name</label>
                    <input type="text" value={formData.company_name} onChange={e => setFormData(s => ({ ...s, company_name: e.target.value }))}
                      className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" placeholder="e.g. Acme Corp" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">GSTIN</label>
                    <input type="text" value={formData.gstin} onChange={e => setFormData(s => ({ ...s, gstin: e.target.value }))}
                      className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs text-on-surface-variant">Room Arrangement</label>
                  <div className="flex gap-2">
                    {['single', 'double', 'twin'].map(r => (
                      <button key={r} type="button" onClick={() => setFormData(s => ({ ...s, room_preference: r }))}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${formData.room_preference === r ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
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
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant hover:text-on-surface">
                      <input type="checkbox" checked={formData[key]} onChange={e => setFormData(s => ({ ...s, [key]: e.target.checked }))} className="rounded border-outline-variant text-purple-600 focus:ring-purple-600" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Travel Style */}
            <div className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Travel Style / Pace</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-xs">
                {TRAVEL_STYLES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFormData(s => ({ ...s, pace: s.value }))}
                    className={`flex flex-col items-center gap-1 p-xs rounded-xl border text-center transition-all ${
                      formData.pace === s.value
                        ? 'bg-purple-500/10 border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                        : 'border-outline-variant/60 text-on-surface-variant hover:border-purple-300'
                    }`}
                  >
                    <span className="text-lg">{s.label}</span>
                    <span className="text-xs">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Special Preferences */}
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Special Preferences / Notes</span>
              <textarea 
                value={formData.preferences_text} 
                onChange={(e) => setFormData(s => ({ ...s, preferences_text: e.target.value }))} 
                rows={3}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition-all resize-none dark:bg-slate-800 dark:text-white" 
                placeholder="e.g. Vegetarian food only, luxury 4-star hotels, include houseboat stay..." 
              />
            </label>

            {/* Advanced Preferences Toggle */}
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 font-semibold bg-transparent border-none p-0 cursor-pointer w-fit">
              <span className="material-symbols-outlined text-[18px] transition-transform" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)' }}>chevron_right</span>
              {showAdvanced ? 'Hide Advanced Preferences' : 'Show Advanced Preferences'}
            </button>

            {/* Advanced Preferences Panel */}
            {showAdvanced && (
              <div className="flex flex-col gap-5 p-5 rounded-xl border border-outline-variant bg-slate-50 dark:bg-slate-800/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Margin (%)</label>
                      <input type="number" min="0" max="100" value={formData.margin} onChange={e => setFormData(s => ({ ...s, margin: e.target.value }))}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Tax (%)</label>
                      <input type="number" min="0" max="100" value={formData.tax} onChange={e => setFormData(s => ({ ...s, tax: e.target.value }))}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Start Date</label>
                    <input type="date" value={formData.start_date} onChange={e => setFormData(s => ({ ...s, start_date: e.target.value }))}
                      className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">End Date</label>
                    <input type="date" min={formData.start_date || undefined} value={formData.end_date} onChange={e => {
                      setFormData(s => ({ ...s, end_date: e.target.value }));
                      if (formData.start_date && e.target.value) {
                        const d1 = new Date(formData.start_date);
                        const d2 = new Date(e.target.value);
                        if (!isNaN(d1) && !isNaN(d2)) {
                          const diff = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
                          setFormData(s => ({ ...s, duration: diff }));
                        }
                      }
                    }} className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant">Hotel Category</label>
                  <div className="flex flex-wrap gap-2">
                    {['1_star', '2_star', '3_star', '4_star', '5_star', 'boutique'].map(c => (
                      <button key={c} type="button" onClick={() => setFormData(s => ({ ...s, hotel_category: c }))}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${formData.hotel_category === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                        {c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant">Flight Class</label>
                  <div className="flex gap-2">
                    {['economy', 'business', 'first'].map(c => (
                      <button key={c} type="button" onClick={() => setFormData(s => ({ ...s, flight_class: c }))}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${formData.flight_class === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-on-surface-variant">Transport Type</label>
                  <div className="flex gap-2">
                    {['private_car', 'shared_transfer', 'self_drive'].map(c => (
                      <button key={c} type="button" onClick={() => setFormData(s => ({ ...s, transport_type: c }))}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${formData.transport_type === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                        {c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Dietary Needs</label>
                    <select value={formData.dietary} onChange={e => setFormData(s => ({ ...s, dietary: e.target.value }))} className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white">
                      <option value="">No Restrictions</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="jain">Jain</option>
                      <option value="non_veg">Non-Veg</option>
                      <option value="local">Local Authentic</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Budget Flexibility</label>
                    <select value={formData.budget_flexibility} onChange={e => setFormData(s => ({ ...s, budget_flexibility: e.target.value }))} className="px-3 py-2 text-sm border border-outline-variant rounded-lg dark:bg-slate-800 dark:text-white">
                      <option value="strict">Strict - Do not exceed</option>
                      <option value="flexible">Flexible for experiences</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-on-surface-variant">Children (Extra Beds)</label>
                  <div className="flex items-center gap-3 mb-1">
                    <button type="button" onClick={() => setFormData(s => ({ ...s, num_children: Math.max(0, s.num_children - 1) }))} className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center border-none cursor-pointer text-lg leading-none">−</button>
                    <span className="text-sm font-semibold">{formData.num_children}</span>
                    <button type="button" onClick={() => setFormData(s => ({ ...s, num_children: Math.min(6, s.num_children + 1) }))} className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center border-none cursor-pointer text-lg leading-none">+</button>
                  </div>
                  {formData.num_children > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: formData.num_children }).map((_, i) => (
                        <input key={i} type="number" min="0" max="17" placeholder="Age"
                          value={formData.child_ages[i] || ''}
                          onChange={e => {
                            const newAges = [...formData.child_ages];
                            newAges[i] = parseInt(e.target.value, 10);
                            setFormData(s => ({ ...s, child_ages: newAges }));
                          }}
                          className="w-16 px-2 py-1.5 text-xs border border-outline-variant rounded-lg text-center dark:bg-slate-800 dark:text-white" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit CTA */}
            <div className="flex justify-end gap-md pt-lg border-t border-outline-variant/50">
              <button 
                type="button" 
                onClick={() => setMode('blank')} 
                className="px-xl py-md border border-outline-variant text-on-surface font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Switch to Manual
              </button>
              <button 
                type="submit" 
                className="px-xl py-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                Generate Itinerary with AI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pre-populated QuickGenerateModal */}
      <QuickGenerateModal 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
        initialData={aiInitialData} 
      />
    </div>
  );
}

