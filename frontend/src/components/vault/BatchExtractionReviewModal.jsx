import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

export default function BatchExtractionReviewModal({ isOpen, onClose, batchData = [], onSuccess, isEditMode = false }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [packages, setPackages] = useState(() => (batchData && batchData.length > 0) ? JSON.parse(JSON.stringify(batchData)) : []);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'days', 'hotels', 'extra'
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const lastBatchRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen && batchData && batchData.length > 0) {
      const batchSig = JSON.stringify(batchData);
      if (lastBatchRef.current !== batchSig) {
        lastBatchRef.current = batchSig;
        setPackages(JSON.parse(batchSig));
        setActiveIdx(0);
        setErrorMsg(null);
      }
    } else if (!isOpen) {
      lastBatchRef.current = null;
    }
  }, [isOpen, batchData]);

  if (!isOpen || !batchData || batchData.length === 0) return null;

  const currentPkg = packages[activeIdx] || {};
  const fieldsMeta = currentPkg.fields || {};
  const overallConf = currentPkg.overall_confidence_score || currentPkg.confidence_score || 0.9;

  const isConfirmed = currentPkg._confirmed === true;

  const handleFieldChange = (path, value) => {
    const updated = [...packages];
    updated[activeIdx] = { ...updated[activeIdx], [path]: value };
    if (updated[activeIdx].fields && updated[activeIdx].fields[path]) {
      updated[activeIdx].fields[path].doubtful = false;
      updated[activeIdx].fields[path].needs_review = false;
    }
    setPackages(updated);
  };

  const handleDayChange = (dayIndex, field, value) => {
    const updated = [...packages];
    const days = [...(updated[activeIdx].days || [])];
    if (days[dayIndex]) {
      days[dayIndex] = { ...days[dayIndex], [field]: value };
      updated[activeIdx].days = days;
      setPackages(updated);
    }
  };

  const handleHotelChange = (hotelIndex, field, value) => {
    const updated = [...packages];
    const hotels = [...(updated[activeIdx].hotels || [])];
    if (hotels[hotelIndex]) {
      hotels[hotelIndex] = { ...hotels[hotelIndex], [field]: value };
      updated[activeIdx].hotels = hotels;
      setPackages(updated);
    }
  };

  const handleExtraSectionChange = (secKey, value) => {
    const updated = [...packages];
    const extra = { ...(updated[activeIdx].extra_sections || {}) };
    extra[secKey] = value;
    updated[activeIdx].extra_sections = extra;
    setPackages(updated);
  };

  const getConfBadge = (score) => {
    const pct = Math.round(score * 100);
    if (pct >= 90) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {pct}% High Accuracy
        </span>
      );
    } else if (pct >= 75) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {pct}% Review Recommended
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
          {pct}% Low Accuracy - Verify Below
        </span>
      );
    }
  };

  const renderDoubtWrapper = (path, children, label) => {
    const meta = fieldsMeta[path] || {};
    const isDoubt = meta.doubtful === true || meta.needs_review === true;
    const reason = meta.doubt_reason || `Double check ${label.toLowerCase()} accuracy from PDF.`;

    if (!isDoubt) {
      return (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">{label}</label>
          {children}
        </div>
      );
    }

    return (
      <div className="space-y-1.5 p-3 rounded-xl border-2 border-dashed border-error/60 bg-error/5 relative transition-all">
        <div className="flex items-center justify-between text-xs font-semibold text-error">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">warning</span>
            ⚠️ Doubtful Detection: {label}
          </span>
          <span className="underline decoration-error decoration-wavy decoration-2 font-mono text-[11px] px-2 py-0.5 bg-error/10 rounded">
            Check Required
          </span>
        </div>
        <p className="text-[11px] text-error/80 italic">{reason}</p>
        <div className="pt-1 underline decoration-error decoration-wavy decoration-2">
          {children}
        </div>
      </div>
    );
  };

  const syncSingleToLocal = (pkg) => {
    try {
      // 1. Save to voyanta_vault_items
      const existingVault = JSON.parse(localStorage.getItem('voyanta_vault_items') || '[]');
      const pkgId = pkg.id || `vault_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const savedPkg = {
        ...pkg,
        id: pkgId,
        parsed_data: pkg.parsed_data || pkg,
        status: 'active',
        created_at: pkg.created_at || new Date().toISOString()
      };
      const filtered = existingVault.filter(item => String(item.id) !== String(pkgId) && !(item.destination && pkg.destination && item.destination.toLowerCase() === pkg.destination.toLowerCase() && item._pdf_filename === pkg._pdf_filename));
      filtered.unshift(savedPkg);
      localStorage.setItem('voyanta_vault_items', JSON.stringify(filtered));
      // NOTE: Do NOT dispatch voyanta:vault-updated here — the modal is still open.
      // MyVaultPage.onSuccess + loadVaultItems(false) will refresh after modal closes.

      // 2. Save to voyanta_unified_library
      const libraryStr = localStorage.getItem('voyanta_unified_library') || '[]';
      let library = JSON.parse(libraryStr);
      let updated = false;
      const parsed = pkg.parsed_data || pkg || {};
      const hotels = parsed.hotels || [];
      const activities = parsed.activities || [];

      hotels.forEach(h => {
        const id = h.id || `hotel_${pkgId}_${(h.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (!library.some(item => String(item.id) === String(id))) {
          library.push({
            id,
            name: h.name || 'Hotel',
            type: 'hotel',
            location: h.location || pkg.destination || '',
            rate: h.rate || h.price || 0,
            cover_image: h.cover_image || h.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
            details: h.details || h.description || '',
            description: h.details || h.description || '',
            source: 'vault',
            pkg_id: pkgId
          });
          updated = true;
        }
      });

      activities.forEach(act => {
        const id = act.id || `activity_${pkgId}_${(act.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (!library.some(item => String(item.id) === String(id))) {
          library.push({
            id,
            name: act.name || 'Activity',
            type: 'activity',
            location: act.location || pkg.destination || '',
            rate: act.rate || act.price || 0,
            cover_image: act.cover_image || act.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
            details: act.details || act.description || '',
            description: act.details || act.description || '',
            source: 'vault',
            pkg_id: pkgId
          });
          updated = true;
        }
      });

      const itineraryId = `itinerary_${pkgId}`;
      if (!library.some(item => String(item.id) === String(itineraryId))) {
        library.push({
          id: itineraryId,
          name: pkg.name || `${pkg.destination || 'Custom'} Tour Package`,
          type: 'itinerary',
          location: pkg.destination || '',
          rate: pkg.budget || pkg.total_price || 0,
          cover_image: pkg.cover_image || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
          details: `${pkg.duration_days || parsed.duration_days || 0} Days itinerary package`,
          description: pkg.itinerary_text || parsed.overview || '',
          days: parsed.days || [],
          source: 'vault',
          pkg_id: pkgId
        });
        updated = true;
      }

      if (updated) {
        localStorage.setItem('voyanta_unified_library', JSON.stringify(library));
        window.dispatchEvent(new Event('voyanta:unified-library-updated'));
      }
    } catch (err) {
      console.warn('Local save error:', err);
    }
  };

  const confirmPackage = async (pkgToConfirm, index) => {
    setConfirming(true);
    setErrorMsg(null);
    const confirmedPkg = { ...pkgToConfirm, _confirmed: true, id: pkgToConfirm.id || `vault_${Date.now()}_${index}` };
    try {
      syncSingleToLocal(confirmedPkg);
      if (isEditMode && onSuccess) {
        onSuccess([confirmedPkg]);
        onClose();
        // Background optimistic cloud sync without blocking UI
        (async () => {
          try {
            let token = null;
            await supabase?.auth?.refreshSession?.();
            const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
            token = session?.access_token || null;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            if (confirmedPkg.id && !String(confirmedPkg.id).startsWith('vault_')) {
              await fetch(`/api/vault/packages/${confirmedPkg.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(confirmedPkg)
              });
            }
          } catch (err) {
            console.warn('Background edit sync to server failed (offline fallback active):', err);
          }
        })();
        return;
      }

      let token = null;
      try {
        await supabase?.auth?.refreshSession?.();
        const { data: { session } } = await supabase?.auth?.getSession?.() || { data: { session: null } };
        token = session?.access_token || null;
      } catch (err) {
        console.warn('Session check warning during confirm:', err);
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res;
      if (isEditMode && confirmedPkg.id && !String(confirmedPkg.id).startsWith('vault_')) {
        res = await fetch(`/api/vault/packages/${confirmedPkg.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(confirmedPkg)
        });
      } else {
        res = await fetch('/api/import/confirm', {
          method: 'POST',
          headers,
          body: JSON.stringify(confirmedPkg)
        });
      }

      if (!res.ok) {
        console.warn('Server sync returned error, kept in local vault & library storage');
      }
    } catch (err) {
      console.warn('Error syncing to server during confirm (offline fallback active):', err);
    } finally {
      const updated = [...packages];
      updated[index] = confirmedPkg;
      setPackages(updated);

      const nextUnconfirmed = updated.findIndex((p, i) => i > index && !p._confirmed);
      if (nextUnconfirmed !== -1) {
        setActiveIdx(nextUnconfirmed);
      } else {
        const anyRemaining = updated.findIndex(p => !p._confirmed);
        if (anyRemaining === -1) {
          if (onSuccess) onSuccess(updated);
          onClose();
        } else {
          setActiveIdx(anyRemaining);
        }
      }
      setConfirming(false);
    }
  };

  const confirmAllRemaining = async () => {
    setConfirming(true);
    setErrorMsg(null);
    try {
      for (let i = 0; i < packages.length; i++) {
        if (!packages[i]._confirmed) {
          await confirmPackage(packages[i], i);
        }
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-fade-in">
      <div className="bg-surface border border-subtle rounded-3xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">fact_check</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                {isEditMode ? 'Edit Saved Vault Package' : 'Agent Review & Accuracy Check'}
                <span className="text-xs font-normal text-tertiary px-2 py-0.5 rounded-full bg-surface border border-subtle">
                  {packages.length} {isEditMode ? 'Package' : `File${packages.length > 1 ? 's' : ''} in Batch`}
                </span>
              </h2>
              <p className="text-xs text-secondary">
                {isEditMode 
                  ? 'Modify any extracted field, itinerary days, hotels, or extra sections and save changes directly to your AI Vault.' 
                  : 'Verify extracted values before persisting to AI Vault. Doubtful fields are underlined with red wavy lines.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {errorMsg && (
              <span className="text-xs text-error bg-error/10 px-3 py-1 rounded-lg border border-error/20 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorMsg}
              </span>
            )}
            <button
              onClick={onClose}
              disabled={confirming}
              className="p-2 rounded-xl text-tertiary hover:text-primary hover:bg-surface-hover transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Main Layout: Sidebar (Batch List) + Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar: Batch Navigation */}
          {packages.length > 1 && (
            <div className="w-64 border-r border-subtle bg-surface-hover/10 flex flex-col overflow-y-auto p-3 space-y-2">
              <div className="text-xs font-semibold text-tertiary px-2 pt-1 uppercase tracking-wider">
                Files ({packages.filter(p => p._confirmed).length}/{packages.length} Saved)
              </div>
              {packages.map((pkg, idx) => {
                const pConf = pkg.overall_confidence_score || pkg.confidence_score || 0.9;
                const isSelected = activeIdx === idx;
                const pkgConfirmed = pkg._confirmed === true;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveIdx(idx)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : pkgConfirmed
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 opacity-70 hover:opacity-100'
                        : 'bg-surface border-subtle hover:border-strong text-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate flex-1">
                        {pkg.destination || pkg._pdf_filename || `File #${idx + 1}`}
                      </span>
                      {pkgConfirmed ? (
                        <span className="material-symbols-outlined text-sm text-emerald-500 shrink-0">check_circle</span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-subtle">
                          {Math.round(pConf * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-tertiary">
                      <span className="truncate">{pkg.duration_days || 0} Days • {pkg.currency || 'INR'} {pkg.total_price || 'N/A'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 bg-surface">
            
            {/* Top Package Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-hover/20 border border-subtle">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-primary">description</span>
                <div>
                  <h3 className="font-bold text-primary text-base">
                    {currentPkg._pdf_filename || currentPkg.pdf_filename || 'Extracted Package'}
                  </h3>
                  <p className="text-xs text-secondary">
                    Source: <span className="font-semibold uppercase">{currentPkg.source_type || 'PDF'}</span> • Hashes & text linked
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getConfBadge(overallConf)}
                {isConfirmed && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Saved to Vault
                  </span>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-subtle pb-2">
              {[
                { id: 'summary', label: 'Summary & Price', icon: 'payments' },
                { id: 'days', label: `Itinerary Days (${(currentPkg.days || []).length})`, icon: 'calendar_month' },
                { id: 'hotels', label: `Hotels (${(currentPkg.hotels || []).length})`, icon: 'hotel' },
                { id: 'extra', label: `Extra Sections (${Object.keys(currentPkg.extra_sections || {}).length})`, icon: 'menu_book' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-secondary hover:bg-surface-hover hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Summary & Price */}
            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  {renderDoubtWrapper(
                    'destination',
                    <input
                      type="text"
                      value={currentPkg.destination || ''}
                      onChange={e => handleFieldChange('destination', e.target.value)}
                      placeholder="Primary Destination"
                      className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm font-medium text-primary focus:outline-none focus:border-primary transition-all"
                    />,
                    'Destination Name'
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {renderDoubtWrapper(
                      'total_price',
                      <input
                        type="number"
                        value={currentPkg.total_price ?? ''}
                        onChange={e => handleFieldChange('total_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm font-medium text-primary focus:outline-none focus:border-primary transition-all font-mono"
                      />,
                      'Total Price'
                    )}

                    {renderDoubtWrapper(
                      'currency',
                      <select
                        value={currentPkg.currency || 'INR'}
                        onChange={e => handleFieldChange('currency', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm font-medium text-primary focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="INR">₹ INR</option>
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                        <option value="AED">AED</option>
                      </select>,
                      'Currency'
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {renderDoubtWrapper(
                      'duration_days',
                      <input
                        type="number"
                        value={currentPkg.duration_days || (currentPkg.days || []).length || 1}
                        onChange={e => handleFieldChange('duration_days', parseInt(e.target.value, 10) || 1)}
                        className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm font-medium text-primary focus:outline-none focus:border-primary transition-all"
                      />,
                      'Duration (Days)'
                    )}

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">Sub-Destinations</label>
                      <input
                        type="text"
                        value={(currentPkg.sub_destinations || []).join(', ')}
                        onChange={e => handleFieldChange('sub_destinations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="e.g. Shillong, Cherrapunji"
                        className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm font-medium text-primary focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">Overview / Introduction</label>
                    <textarea
                      rows={7}
                      value={currentPkg.overview || ''}
                      onChange={e => handleFieldChange('overview', e.target.value)}
                      placeholder="Trip overview or introduction text extracted from document..."
                      className="w-full px-4 py-3 rounded-xl border border-subtle bg-surface text-sm text-primary focus:outline-none focus:border-primary transition-all leading-relaxed resize-y"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Itinerary Days */}
            {activeTab === 'days' && (
              <div className="space-y-4 animate-fade-in">
                {(currentPkg.days || []).length === 0 ? (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-error/50 bg-error/5 text-center space-y-2">
                    <span className="material-symbols-outlined text-3xl text-error">calendar_today</span>
                    <p className="text-sm font-semibold text-error underline decoration-error decoration-wavy decoration-2">
                      No day-by-day itinerary extracted from this document.
                    </p>
                    <p className="text-xs text-secondary">You can manually add days or check if the PDF format has table schedules.</p>
                  </div>
                ) : (
                  (currentPkg.days || []).map((day, dIdx) => (
                    <div key={dIdx} className="p-4 rounded-2xl border border-subtle bg-surface-hover/10 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          Day {day.day_number || dIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={day.title || ''}
                          onChange={e => handleDayChange(dIdx, 'title', e.target.value)}
                          placeholder="Day Title (e.g. Arrival in Shillong & Sightseeing)"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-subtle bg-surface text-sm font-semibold text-primary focus:outline-none focus:border-primary"
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={day.description || ''}
                        onChange={e => handleDayChange(dIdx, 'description', e.target.value)}
                        placeholder="Day schedule and detailed activities..."
                        className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-xs text-secondary focus:outline-none focus:border-primary leading-relaxed"
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Hotels */}
            {activeTab === 'hotels' && (
              <div className="space-y-4 animate-fade-in">
                {renderDoubtWrapper(
                  'hotels',
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(currentPkg.hotels || []).length === 0 ? (
                      <div className="col-span-full p-8 rounded-2xl border border-subtle text-center text-secondary text-xs">
                        No specific hotel stays itemized in this document.
                      </div>
                    ) : (
                      (currentPkg.hotels || []).map((hotel, hIdx) => {
                        const hasPrice = hotel.price_per_night !== null && hotel.price_per_night !== undefined;
                        return (
                          <div
                            key={hIdx}
                            className={`p-4 rounded-2xl border space-y-3 ${
                              !hasPrice ? 'border-2 border-dashed border-error/60 bg-error/5 underline decoration-error decoration-wavy' : 'border-subtle bg-surface-hover/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={hotel.name || ''}
                                onChange={e => handleHotelChange(hIdx, 'name', e.target.value)}
                                placeholder="Hotel Name"
                                className="font-bold text-sm text-primary bg-transparent border-b border-subtle focus:border-primary focus:outline-none flex-1"
                              />
                              {!hasPrice && (
                                <span className="text-[10px] font-semibold text-error px-2 py-0.5 rounded bg-error/10">
                                  ⚠️ Missing Price
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] text-tertiary">Category</label>
                                <input
                                  type="text"
                                  value={hotel.category || ''}
                                  onChange={e => handleHotelChange(hIdx, 'category', e.target.value)}
                                  placeholder="4 Star Deluxe"
                                  className="w-full px-2 py-1 rounded border border-subtle bg-surface text-secondary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-tertiary">Price/Night ({currentPkg.currency || 'INR'})</label>
                                <input
                                  type="number"
                                  value={hotel.price_per_night ?? ''}
                                  onChange={e => handleHotelChange(hIdx, 'price_per_night', parseFloat(e.target.value) || null)}
                                  placeholder="Not Stated"
                                  className="w-full px-2 py-1 rounded border border-subtle bg-surface text-secondary font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>,
                  'Itemized Hotel List & Pricing'
                )}
              </div>
            )}

            {/* Tab 4: Extra Sections */}
            {activeTab === 'extra' && (
              <div className="space-y-4 animate-fade-in">
                {Object.keys(currentPkg.extra_sections || {}).length === 0 ? (
                  <div className="p-8 rounded-2xl border border-subtle text-center text-secondary text-xs">
                    No extra sections (Inclusions, What to Pack, Visa info) discovered at the end of this document.
                  </div>
                ) : (
                  Object.entries(currentPkg.extra_sections || {}).map(([secKey, secContent], sIdx) => (
                    <div key={sIdx} className="p-4 rounded-2xl border border-subtle bg-surface-hover/10 space-y-2">
                      <label className="block font-bold text-xs text-primary uppercase tracking-wider">
                        {secKey.replace(/_/g, ' ')}
                      </label>
                      <textarea
                        rows={4}
                        value={secContent || ''}
                        onChange={e => handleExtraSectionChange(secKey, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-xs text-secondary focus:outline-none focus:border-primary leading-relaxed"
                      />
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-subtle bg-surface-hover/20 flex items-center justify-between">
          <div className="text-xs text-secondary">
            {isConfirmed ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                This package has been confirmed & saved to AI Vault.
              </span>
            ) : (
              <span>Review underlined fields and click confirm to save.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {packages.length > 1 && !isEditMode && (
              <button
                onClick={confirmAllRemaining}
                disabled={confirming || packages.every(p => p._confirmed)}
                className="px-4 py-2.5 rounded-xl border border-subtle hover:border-strong text-secondary hover:text-primary text-xs font-semibold transition-all disabled:opacity-50"
              >
                Confirm All Remaining ({packages.filter(p => !p._confirmed).length})
              </button>
            )}
            <button
              onClick={() => confirmPackage(currentPkg, activeIdx)}
              disabled={confirming || (!isEditMode && isConfirmed)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-bold text-xs shadow-lg shadow-primary/25 hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {confirming ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  Saving to Vault...
                </>
              ) : (!isEditMode && isConfirmed) ? (
                <>
                  <span className="material-symbols-outlined text-sm">done</span>
                  Already Confirmed
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  {isEditMode ? 'Save Changes' : `Confirm & Save (${activeIdx + 1}/${packages.length})`}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
