import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProposalStore } from '../../store/proposalStore.js';
import { INDIA_SUB_DESTINATIONS, getCandidateTokens } from '../../lib/destinationHierarchy.js';

export default function QuickIntakeModal({ isOpen, onClose }) {
  const { assemble1Shot, status } = useProposalStore();

  const [clientName, setClientName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [destinationInput, setDestinationInput] = useState('Himachal');
  const [selectedDestinations, setSelectedDestinations] = useState(['Manali']);
  const [durationDays, setDurationDays] = useState(3);
  const [numAdults, setNumAdults] = useState(2);
  const [numChildren, setNumChildren] = useState(0);
  const [hasElderly, setHasElderly] = useState(false);
  const [groupType, setGroupType] = useState('friends');
  const [pace, setPace] = useState('medium');
  const [budgetPerHead, setBudgetPerHead] = useState(25000);
  const [preferencesText, setPreferencesText] = useState('');
  const [marginType, setMarginType] = useState('percentage');
  const [marginValue, setMarginValue] = useState(15);
  const [feasibilityWarning, setFeasibilityWarning] = useState('');

  // Auto-suggest Pace based on Group Composition
  useEffect(() => {
    if (hasElderly || numChildren > 0) {
      setPace('slow');
    } else if (groupType === 'friends') {
      setPace('medium');
    }
  }, [hasElderly, numChildren, groupType]);

  // Instant local memory feasibility check (0ms overhead)
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

  // Sub-destination instant suggestions
  const suggestedDestinations = ['Solang Valley', 'Kasol', 'Sissu', 'Shimla', 'Cherrapunji', 'Dawki', 'Gulmarg', 'Pangong Tso'].filter(
    d => !selectedDestinations.includes(d)
  ).slice(0, 4);

  const addDestinationPill = (destName) => {
    if (!selectedDestinations.includes(destName)) {
      setSelectedDestinations([...selectedDestinations, destName]);
    }
  };

  const removeDestinationPill = (destName) => {
    setSelectedDestinations(selectedDestinations.filter(d => d !== destName));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalDest = selectedDestinations.length > 0 ? selectedDestinations.join(', ') : destinationInput;
    
    await assemble1Shot({
      client_name: clientName || 'Valued Traveler',
      contact_info: contactInfo,
      destination: finalDest,
      duration_days: Number(durationDays) || 3,
      group_type: groupType,
      pace: pace,
      budget_per_head: Number(budgetPerHead) || 25000,
      num_travelers: Number(numAdults) + Number(numChildren),
      preferences_text: preferencesText,
      margin_type: marginType,
      margin_value: Number(marginValue) || 15
    });

    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-surface-container-high text-on-surface rounded-2xl shadow-2xl border border-outline-variant p-6 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">1-Shot AI Assembly</span>
            <h2 className="text-2xl font-bold font-headline text-on-surface">30-Second Quick Itinerary Intake</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Client Name & Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Client Name</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
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

          {/* Row 2: Destination Autocomplete & Smart Pills */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Destination(s)</label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-surface border border-outline-variant rounded-xl min-h-[44px]">
              {selectedDestinations.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-container text-on-primary-container text-xs font-semibold rounded-lg">
                  {d}
                  <button type="button" onClick={() => removeDestinationPill(d)} className="hover:text-error">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={selectedDestinations.length === 0 ? "Type destination e.g. Manali, Shillong..." : "Add another..."}
                value={destinationInput}
                onChange={(e) => setDestinationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && destinationInput.trim()) {
                    e.preventDefault();
                    addDestinationPill(destinationInput.trim());
                    setDestinationInput('');
                  }
                }}
                className="flex-1 bg-transparent border-none focus:outline-none text-on-surface text-sm min-w-[120px]"
              />
            </div>

            {/* Instant Suggestions Bar */}
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

            {/* Instant Feasibility Warning Pill */}
            {feasibilityWarning && (
              <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                <span>{feasibilityWarning}</span>
              </div>
            )}
          </div>

          {/* Row 3: Duration, Group Type, Pace */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Group Type</label>
              <select
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="friends">Friends</option>
                <option value="couples">Couple</option>
                <option value="family">Family</option>
                <option value="solo">Solo</option>
              </select>
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

          {/* Row 4: Group Composition & Elderly Checkbox */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-surface border border-outline-variant rounded-xl items-center">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase text-on-surface-variant">Adults:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={numAdults}
                onChange={(e) => setNumAdults(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-center font-bold text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase text-on-surface-variant">Kids:</label>
              <input
                type="number"
                min="0"
                max="20"
                value={numChildren}
                onChange={(e) => setNumChildren(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-center font-bold text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="elderlyCheck"
                checked={hasElderly}
                onChange={(e) => setHasElderly(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <label htmlFor="elderlyCheck" className="text-xs font-semibold text-on-surface cursor-pointer select-none">
                Elderly Present (60+)
              </label>
            </div>
          </div>

          {/* Row 5: Budget & Margin Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Budget / Head (₹)</label>
              <input
                type="number"
                step="1000"
                value={budgetPerHead}
                onChange={(e) => setBudgetPerHead(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Full-Budget Margin Type</label>
              <select
                value={marginType}
                onChange={(e) => setMarginType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Margin Value</label>
              <input
                type="number"
                value={marginValue}
                onChange={(e) => setMarginValue(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
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

          {/* Action Submit Button */}
          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant">
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
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
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
        </form>
      </motion.div>
    </div>
  );
}
