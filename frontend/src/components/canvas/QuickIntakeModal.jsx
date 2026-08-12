import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProposalStore } from '../../store/proposalStore.js';
import { INDIA_SUB_DESTINATIONS, getLocalSubDestinations } from '../../lib/destinationHierarchy.js';
import FlyingLoader from '../common/FlyingLoader.jsx';

export default function QuickIntakeModal({ isOpen, onClose }) {
  const { proposal, client, costingPrefs, assemble1Shot, status, ragStatus, vaultStatus } = useProposalStore();

  const [clientName, setClientName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  
  // Phase 3 Fields
  const [daysPerDestination, setDaysPerDestination] = useState({});
  const [numAdults, setNumAdults] = useState(2);
  const [numChildren, setNumChildren] = useState(0);
  const [budgetBand, setBudgetBand] = useState('mid'); // 'low' | 'mid' | 'high'
  const [selectedThemes, setSelectedThemes] = useState(['family']); // family, honeymoon, adventure, budget, luxury
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startCity, setStartCity] = useState('Guwahati');

  // Advanced & Corporate Fields
  const [childAges, setChildAges] = useState([]);
  const [hotelCategory, setHotelCategory] = useState('4_star');
  const [flightClass, setFlightClass] = useState('economy');
  const [transportType, setTransportType] = useState('private_car');
  const [dietary, setDietary] = useState('');
  const [budgetFlexibility, setBudgetFlexibility] = useState('strict');
  
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [roomPreference, setRoomPreference] = useState('double');
  const [requiresGstInvoice, setRequiresGstInvoice] = useState(false);
  const [singleRoomSupplement, setSingleRoomSupplement] = useState(false);
  const [earlyCheckinRequired, setEarlyCheckinRequired] = useState(false);
  const [lateCheckoutRequired, setLateCheckoutRequired] = useState(false);
  const [meetingRoomRequired, setMeetingRoomRequired] = useState(false);
  const [corporateCancellationTerms, setCorporateCancellationTerms] = useState(false);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  // Existing Fields
  const [durationDays, setDurationDays] = useState(3);
  const [hasElderly, setHasElderly] = useState(false);
  const [groupType, setGroupType] = useState('friends');
  const [pace, setPace] = useState('medium');
  const [budgetPerHead, setBudgetPerHead] = useState(25000);
  const [preferencesText, setPreferencesText] = useState('');
  const [marginType, setMarginType] = useState('percentage');
  const [marginValue, setMarginValue] = useState(15);
  const [taxValue, setTaxValue] = useState(5);
  const [feasibilityWarning, setFeasibilityWarning] = useState('');

  // Sync state from current active proposal and client whenever modal opens or proposal updates
  useEffect(() => {
    if (isOpen) {
      const activeClientName = client?.customer_name || proposal?.client_name || '';
      setClientName(activeClientName);

      const activeContact = client?.contact_info || client?.email || client?.phone || '';
      setContactInfo(activeContact);

      const rawDest = proposal?.destination || client?.destination || '';
      if (rawDest) {
        const parts = rawDest.split(',').map(s => s.trim()).filter(Boolean);
        setSelectedDestinations(parts.length > 0 ? parts : [rawDest]);
        const initialDays = {};
        (parts.length > 0 ? parts : [rawDest]).forEach(d => { initialDays[d] = 1; });
        setDaysPerDestination(initialDays);
      } else {
        setSelectedDestinations([]);
        setDaysPerDestination({});
      }

      setDestinationInput('');
      setDurationDays(proposal?.duration_days || 3);
      setNumAdults(proposal?.num_travelers || 2);
      setNumChildren(0);
      setStartDate(client?.start_date || '');
      setEndDate(client?.end_date || '');
      setStartCity(client?.arrival_city || 'Guwahati');

      const headBudget = proposal?.price_per_person || (proposal?.total_price ? Math.round(proposal.total_price / (proposal?.num_travelers || 2)) : Number(client?.budget) || 25000);
      setBudgetPerHead(headBudget);
      if (headBudget < 15000) setBudgetBand('low');
      else if (headBudget > 35000) setBudgetBand('high');
      else setBudgetBand('mid');

      setMarginValue(costingPrefs?.pct_markup || 15);
      setTaxValue(costingPrefs?.tax || 5);
      setPreferencesText(proposal?.extra_sections?.what_to_pack || '');
    }
  }, [isOpen, proposal, client, costingPrefs]);

  // Keep total duration synchronized with sum of per-destination days
  useEffect(() => {
    if (selectedDestinations.length > 0) {
      const total = selectedDestinations.reduce((sum, d) => sum + (daysPerDestination[d] || 1), 0);
      setDurationDays(total);
    }
  }, [daysPerDestination, selectedDestinations]);

  // Auto-suggest Pace based on Group Composition
  useEffect(() => {
    if (hasElderly || numChildren > 0) {
      setPace('slow');
    } else if (groupType === 'friends') {
      setPace('medium');
    }
  }, [hasElderly, numChildren, groupType]);

  // Instant local memory feasibility check
  useEffect(() => {
    if (selectedDestinations.length > 1) {
      const maxAllowed = Math.max(1, Math.floor(durationDays / 1.5));
      if (selectedDestinations.length > maxAllowed) {
        setFeasibilityWarning(`⚠️ ${selectedDestinations.length} destinations in ${durationDays} days may feel rushed for a ${pace} pace. Max recommended: ${maxAllowed}`);
      } else {
        setFeasibilityWarning('');
      }
    } else {
      setFeasibilityWarning('');
    }
  }, [selectedDestinations, durationDays, pace]);

  // Dynamic Vault Suggestions based on typed or selected destination
  const suggestedDestinations = useMemo(() => {
    const targetQuery = (destinationInput || selectedDestinations.join(' ') || client?.destination || proposal?.destination || '').toLowerCase().trim();

    let matches = [];
    if (targetQuery) {
      const localList = getLocalSubDestinations(targetQuery);
      matches = localList.map(item => item.name || item);

      if (matches.length === 0) {
        for (const [regionKey, items] of Object.entries(INDIA_SUB_DESTINATIONS)) {
          if (regionKey.includes(targetQuery) || targetQuery.includes(regionKey)) {
            items.forEach(it => matches.push(it.name));
          } else {
            for (const item of items) {
              if (item.name.toLowerCase().includes(targetQuery)) {
                matches.push(item.name);
              }
            }
          }
        }
      }
    }

    if (matches.length === 0) {
      matches = ['Shillong', 'Cherrapunji', 'Dawki', 'Mawlynnong', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Munnar', 'Alleppey', 'Jaipur', 'Manali'];
    }

    return Array.from(new Set(matches)).filter(d => !selectedDestinations.includes(d)).slice(0, 6);
  }, [destinationInput, selectedDestinations, client?.destination, proposal?.destination]);

  const addDestinationPill = (destName) => {
    if (destName && !selectedDestinations.includes(destName)) {
      setSelectedDestinations([...selectedDestinations, destName]);
      setDaysPerDestination(prev => ({ ...prev, [destName]: 1 }));
    }
  };

  const removeDestinationPill = (destName) => {
    setSelectedDestinations(selectedDestinations.filter(d => d !== destName));
    setDaysPerDestination(prev => {
      const next = { ...prev };
      delete next[destName];
      return next;
    });
  };

  const updateDestinationDays = (destName, delta) => {
    setDaysPerDestination(prev => {
      const current = prev[destName] || 1;
      const nextVal = Math.max(1, current + delta);
      return { ...prev, [destName]: nextVal };
    });
  };

  const toggleThemeTag = (themeKey) => {
    if (selectedThemes.includes(themeKey)) {
      if (selectedThemes.length > 1) {
        setSelectedThemes(selectedThemes.filter(t => t !== themeKey));
      }
    } else {
      setSelectedThemes([...selectedThemes, themeKey]);
    }
  };

  const handleBudgetBandChange = (band) => {
    setBudgetBand(band);
    if (band === 'low') setBudgetPerHead(12000);
    else if (band === 'mid') setBudgetPerHead(25000);
    else if (band === 'high') setBudgetPerHead(45000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalDest = selectedDestinations.length > 0 ? selectedDestinations.join(', ') : destinationInput;
    
    await assemble1Shot({
      client_name: clientName || 'Valued Traveler',
      contact_info: contactInfo,
      destination: finalDest || 'Custom Destination',
      days_per_destination: daysPerDestination,
      duration_days: Number(durationDays) || 3,
      group_type: groupType,
      pace: pace,
      budget_per_head: Number(budgetPerHead) || 25000,
      budget_band: budgetBand,
      num_travelers: Number(numAdults) + Number(numChildren),
      num_adults: Number(numAdults),
      num_children: Number(numChildren),
      theme_tags: selectedThemes,
      start_date: startDate,
      end_date: endDate,
      start_city: startCity,
      preferences_text: preferencesText,
      costing_prefs: {
        ...(costingPrefs || {}),
        margin_type: marginType,
        pct_markup: Number(marginValue),
        margin_value: Number(marginValue),
        tax: Number(taxValue),
        visibility_mode: 'ITEMIZED'
      },
      // Advanced & Corporate
      child_ages: childAges,
      hotel_category: hotelCategory,
      flight_class: flightClass,
      transport_type: transportType,
      dietary: dietary,
      budget_flexibility: budgetFlexibility,
      company_name: companyName,
      gstin: gstin,
      room_preference: roomPreference,
      requires_gst_invoice: requiresGstInvoice,
      single_room_supplement: singleRoomSupplement,
      early_checkin_required: earlyCheckinRequired,
      late_checkout_required: lateCheckoutRequired,
      meeting_room_required: meetingRoomRequired,
      corporate_cancellation_terms: corporateCancellationTerms,
    });

    const currentRagStatus = useProposalStore.getState().ragStatus;
    const currentVaultStatus = useProposalStore.getState().vaultStatus;

    if (currentRagStatus !== 'ok' || currentVaultStatus !== 'ok') {
      setShowWarnings(true);
      return;
    }

    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-surface-container-high text-on-surface rounded-2xl shadow-2xl border border-outline-variant overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-high">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Phase 3: Fast Client Intake</span>
              <h2 className="text-xl sm:text-2xl font-bold font-headline text-on-surface">30-Second Travel ERP Intake</h2>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Scrollable Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Row 1: Client Name & Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Raman Kumar Jha"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Contact Info (Phone / Email)</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210 or email"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
                />
              </div>
            </div>

            {/* Row 2: Destinations (Multi-Select) & Per-Destination Days */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Destinations (Multi-Select)
              </label>
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-surface border border-outline-variant rounded-xl min-h-[44px]">
                {selectedDestinations.map(d => (
                  <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container text-on-primary-container text-xs font-semibold rounded-lg">
                    {d}
                    <button type="button" onClick={() => removeDestinationPill(d)} className="hover:text-error">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={selectedDestinations.length === 0 ? "Type destination e.g. Shillong, Mawsynram..." : "Add another..."}
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && destinationInput.trim()) {
                      e.preventDefault();
                      addDestinationPill(destinationInput.trim());
                      setDestinationInput('');
                    }
                  }}
                  className="flex-1 bg-transparent border-none focus:outline-none text-on-surface text-sm min-w-[140px]"
                />
              </div>

              {/* Dynamic Vault Suggestions Bar */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Vault Suggestions:</span>
                {suggestedDestinations.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addDestinationPill(s)}
                    className="px-2.5 py-1 text-xs font-medium bg-surface-container hover:bg-primary/20 text-primary border border-outline-variant rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[12px]">add</span> {s}
                  </button>
                ))}
              </div>

              {/* Days Per Destination Allocator */}
              {selectedDestinations.length > 0 && (
                <div className="mt-3 p-3 bg-surface-container/60 border border-outline-variant rounded-xl">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Days per Destination (Total: {durationDays} Days)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedDestinations.map(d => (
                      <div key={d} className="flex items-center justify-between px-3 py-1.5 bg-surface border border-outline-variant rounded-lg">
                        <span className="text-xs font-semibold text-on-surface truncate">{d}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDestinationDays(d, -1)}
                            className="w-5 h-5 flex items-center justify-center bg-surface-container text-on-surface rounded font-bold hover:bg-primary/20"
                          >
                            −
                          </button>
                          <span className="text-xs font-bold w-6 text-center text-primary">{daysPerDestination[d] || 1}d</span>
                          <button
                            type="button"
                            onClick={() => updateDestinationDays(d, 1)}
                            className="w-5 h-5 flex items-center justify-center bg-surface-container text-on-surface rounded font-bold hover:bg-primary/20"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instant Feasibility Warning Pill */}
              {feasibilityWarning && (
                <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                  <span>{feasibilityWarning}</span>
                </div>
              )}
            </div>

            {/* Row 3: Pax (Adults & Children) & Arrival Point */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-xl">
                <label className="text-xs font-bold uppercase text-on-surface-variant">Adults:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNumAdults(Math.max(1, numAdults - 1))}
                    className="w-7 h-7 flex items-center justify-center bg-surface-container rounded-lg font-bold"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{numAdults}</span>
                  <button
                    type="button"
                    onClick={() => setNumAdults(numAdults + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-surface-container rounded-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-xl">
                <label className="text-xs font-bold uppercase text-on-surface-variant">Children:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNumChildren(Math.max(0, numChildren - 1))}
                    className="w-7 h-7 flex items-center justify-center bg-surface-container rounded-lg font-bold"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{numChildren}</span>
                  <button
                    type="button"
                    onClick={() => setNumChildren(numChildren + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-surface-container rounded-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Start/End City (Arrival Point)
                </label>
                <select
                  value={startCity}
                  onChange={(e) => setStartCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm font-semibold"
                >
                  <option value="Guwahati">Guwahati (GHY)</option>
                  <option value="Shillong">Shillong</option>
                  <option value="Bagdogra">Bagdogra (IXB)</option>
                  <option value="Srinagar">Srinagar (SXR)</option>
                  <option value="Kochi">Kochi (COK)</option>
                  <option value="Leh">Leh (IXL)</option>
                  <option value="Delhi">Delhi (DEL)</option>
                  <option value="Jaipur">Jaipur (JAI)</option>
                  <option value="Kolkata">Kolkata (CCU)</option>
                </select>
              </div>
            </div>

            {/* Row 4: Budget Band & Theme Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Budget Band (Drives Hotel Filter)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: 'Low (<₹15k)', icon: 'payments' },
                    { id: 'mid', label: 'Mid (₹15k-35k)', icon: 'account_balance_wallet' },
                    { id: 'high', label: 'High (₹35k+)', icon: 'diamond' }
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBudgetBandChange(b.id)}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                        budgetBand === b.id
                          ? 'bg-primary text-on-primary border-primary shadow-md'
                          : 'bg-surface border-outline-variant text-on-surface-variant hover:border-primary/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{b.icon}</span>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corporate Panel */}
              {groupType === 'corporate' && (
                <div className="flex flex-col gap-4 p-4 rounded-xl border border-primary/30 bg-primary/5 col-span-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-lg">work</span>
                    <h4 className="m-0 text-sm font-semibold text-on-surface">Corporate Details</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Company Name</label>
                      <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" placeholder="e.g. Acme Corp" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">GSTIN</label>
                      <input type="text" value={gstin} onChange={e => setGstin(e.target.value)}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" placeholder="22AAAAA0000A1Z5" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-on-surface-variant">Room Arrangement</label>
                    <div className="flex gap-2">
                      {['single', 'double', 'twin'].map(r => (
                        <button key={r} type="button" onClick={() => setRoomPreference(r)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${roomPreference === r ? 'bg-primary text-on-primary border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { key: 'requiresGstInvoice', label: 'GST Invoice', val: requiresGstInvoice, set: setRequiresGstInvoice },
                      { key: 'singleRoomSupplement', label: 'Single Supplement', val: singleRoomSupplement, set: setSingleRoomSupplement },
                      { key: 'meetingRoomRequired', label: 'Meeting Room', val: meetingRoomRequired, set: setMeetingRoomRequired },
                      { key: 'earlyCheckinRequired', label: 'Early Check-in', val: earlyCheckinRequired, set: setEarlyCheckinRequired },
                      { key: 'lateCheckoutRequired', label: 'Late Checkout', val: lateCheckoutRequired, set: setLateCheckoutRequired },
                      { key: 'corporateCancellationTerms', label: 'Strict Cancellation', val: corporateCancellationTerms, set: setCorporateCancellationTerms },
                    ].map(({ key, label, val, set }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant hover:text-on-surface">
                        <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="rounded border-outline-variant text-primary focus:ring-primary" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Group Composition Row */}
              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface p-4 rounded-xl border border-outline-variant">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Group Vibe</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 'friends', l: 'Friends', i: 'group' },
                      { v: 'couple', l: 'Couple', i: 'favorite' },
                      { v: 'family', l: 'Family', i: 'family_restroom' },
                      { v: 'corporate', l: 'Corporate', i: 'work' },
                      { v: 'solo', l: 'Solo', i: 'person' },
                    ].map(g => (
                      <button
                        key={g.v} type="button"
                        onClick={() => setGroupType(g.v)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-semibold flex items-center gap-1.5 transition-colors ${groupType === g.v ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container border-outline-variant text-on-surface-variant'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{g.i}</span>
                        {g.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Pace</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 'fast', l: 'Fast', i: 'bolt' },
                      { v: 'medium', l: 'Balanced', i: 'balance' },
                      { v: 'slow', l: 'Relaxed', i: 'self_improvement' },
                    ].map(p => (
                      <button
                        key={p.v} type="button"
                        onClick={() => setPace(p.v)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-semibold flex items-center gap-1.5 transition-colors ${pace === p.v ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container border-outline-variant text-on-surface-variant'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{p.i}</span>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Theme (Drives Block Ranking)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'family', label: 'Family' },
                    { id: 'honeymoon', label: 'Honeymoon' },
                    { id: 'adventure', label: 'Adventure' },
                    { id: 'budget', label: 'Budget' },
                    { id: 'luxury', label: 'Luxury' }
                  ].map(t => {
                    const isSelected = selectedThemes.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleThemeTag(t.id)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-secondary-container text-on-secondary-container border-secondary font-bold shadow-sm'
                            : 'bg-surface border-outline-variant text-on-surface-variant hover:border-secondary'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 5: Travel Dates & Pace */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Start Date (Seasonal Pricing)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-outline-variant rounded-xl text-on-surface text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-outline-variant rounded-xl text-on-surface text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Travel Pace</label>
                <select
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
                >
                  <option value="slow">Slow (Relaxed / Seniors / Kids)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="fast">Fast (Action-Packed)</option>
                </select>
              </div>
            </div>

            {/* Row 6: Client Preferences Free Text */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Any Special Client Preferences? (Free Text)
              </label>
              <input
                type="text"
                placeholder='e.g. "wants a beach + hills mix", "no trekking", "vegetarian food only"'
                value={preferencesText}
                onChange={(e) => setPreferencesText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
              />
            </div>

            {/* Fixed Action Footer inside Form */}
            <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant bg-surface-container-high sticky bottom-0 z-10 py-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-2.5 text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {status === 'loading' ? (
                  <>
                    <FlyingLoader size="text-[18px]" />
                    Assembling 1-Shot...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Full Proposal (1-Shot)
                  </>
                )}
              </button>
            </div>
            {/* Advanced Preferences */}
            <div className="col-span-full mt-2">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-primary font-semibold bg-transparent border-none p-0 cursor-pointer w-fit">
                <span className="material-symbols-outlined text-[18px] transition-transform" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)' }}>chevron_right</span>
                {showAdvanced ? 'Hide Advanced Preferences' : 'Show Advanced Preferences'}
              </button>

              {showAdvanced && (
                <div className="flex flex-col gap-5 p-5 mt-3 rounded-xl border border-outline-variant bg-surface-container/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Start Date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">End Date</label>
                      <input type="date" value={endDate} min={startDate || undefined} onChange={e => {
                        setEndDate(e.target.value);
                        if (startDate && e.target.value) {
                          const d1 = new Date(startDate);
                          const d2 = new Date(e.target.value);
                          if (!isNaN(d1) && !isNaN(d2)) {
                            const diff = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
                            setDurationDays(diff);
                          }
                        }
                      }} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Hotel Category</label>
                    <div className="flex flex-wrap gap-2">
                      {['1_star', '2_star', '3_star', '4_star', '5_star', 'boutique'].map(c => (
                        <button key={c} type="button" onClick={() => setHotelCategory(c)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${hotelCategory === c ? 'bg-primary text-on-primary border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                          {c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Flight Class</label>
                    <div className="flex gap-2">
                      {['economy', 'business', 'first'].map(c => (
                        <button key={c} type="button" onClick={() => setFlightClass(c)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${flightClass === c ? 'bg-primary text-on-primary border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-on-surface-variant">Transport Type</label>
                    <div className="flex gap-2">
                      {['private_car', 'shared_transfer', 'self_drive'].map(c => (
                        <button key={c} type="button" onClick={() => setTransportType(c)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${transportType === c ? 'bg-primary text-on-primary border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant'}`}>
                          {c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Margin (%)</label>
                      <input type="number" min="0" max="100" value={marginValue} onChange={e => setMarginValue(e.target.value)}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Tax (%)</label>
                      <input type="number" min="0" max="100" value={taxValue} onChange={e => setTaxValue(e.target.value)}
                        className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-on-surface-variant">Dietary Needs</label>
                      <select value={dietary} onChange={e => setDietary(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface">
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
                      <select value={budgetFlexibility} onChange={e => setBudgetFlexibility(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface">
                        <option value="strict">Strict - Do not exceed</option>
                        <option value="flexible">Flexible for experiences</option>
                      </select>
                    </div>
                  </div>

                  {numChildren > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-on-surface-variant">Child Ages</label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: numChildren }).map((_, i) => (
                          <input key={i} type="number" min="0" max="17" placeholder="Age"
                            value={childAges[i] || ''}
                            onChange={e => {
                              const newAges = [...childAges];
                              newAges[i] = parseInt(e.target.value, 10);
                              setChildAges(newAges);
                            }}
                            className="w-16 px-2 py-1.5 text-xs border border-outline-variant rounded-lg text-center bg-surface text-on-surface" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
