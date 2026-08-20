import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { INDIA_SUB_DESTINATIONS, getLocalSubDestinations, isLocationMatch } from '../../lib/destinationHierarchy.js';
import FlyingLoader from '../common/FlyingLoader.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function DayAssemblerPanel({
  isOpen,
  onClose,
  dayNumber,
  proposalDestination,
  onAssemble
}) {
  const toast = useToast();

  const [selectedSubDests, setSelectedSubDests] = useState([]);
  const [selectedHotels, setSelectedHotels] = useState([]);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedTransfers, setSelectedTransfers] = useState([]);
  const [curatorNotes, setCuratorNotes] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  // Library items loaded from local unified cache
  const [libraryHotels, setLibraryHotels] = useState([]);
  const [libraryActivities, setLibraryActivities] = useState([]);
  const [libraryTransfers, setLibraryTransfers] = useState([]);

  // Sub-destination candidates
  const subDestCandidates = useMemo(() => {
    if (!proposalDestination) return [];
    const local = getLocalSubDestinations(proposalDestination);
    const names = local.map(item => item.name || item);
    
    // Also check INDIA_SUB_DESTINATIONS map
    const targetKey = proposalDestination.toLowerCase().trim();
    for (const [regionKey, items] of Object.entries(INDIA_SUB_DESTINATIONS)) {
      if (regionKey.includes(targetKey) || targetKey.includes(regionKey)) {
        items.forEach(it => names.push(it.name));
      }
    }
    return Array.from(new Set(names));
  }, [proposalDestination]);

  // Load items from local unified library
  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem('voyanta_unified_library');
      if (stored) {
        const parsed = JSON.parse(stored);
        setLibraryHotels(parsed.hotels || []);
        setLibraryActivities(parsed.activities || []);
        setLibraryTransfers(parsed.transfers || []);
      }
    } catch (e) {
      console.warn('Failed to load unified library in DayAssemblerPanel:', e);
    }
  }, [isOpen]);

  // Filtered Hotels: sub-destination match first, then destination fallback
  const filteredHotels = useMemo(() => {
    if (libraryHotels.length === 0) return [];
    const activeSub = selectedSubDests[0] || '';
    
    if (activeSub) {
      const subMatches = libraryHotels.filter(h => isLocationMatch(h, activeSub, proposalDestination));
      if (subMatches.length > 0) return subMatches;
    }

    if (proposalDestination) {
      return libraryHotels.filter(h => isLocationMatch(h, proposalDestination, proposalDestination));
    }
    return libraryHotels;
  }, [libraryHotels, selectedSubDests, proposalDestination]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    if (libraryActivities.length === 0) return [];
    const activeSub = selectedSubDests[0] || '';

    if (activeSub) {
      const subMatches = libraryActivities.filter(a => isLocationMatch(a, activeSub, proposalDestination));
      if (subMatches.length > 0) return subMatches;
    }

    if (proposalDestination) {
      return libraryActivities.filter(a => isLocationMatch(a, proposalDestination, proposalDestination));
    }
    return libraryActivities;
  }, [libraryActivities, selectedSubDests, proposalDestination]);

  if (!isOpen) return null;

  const toggleSubDest = (name) => {
    if (selectedSubDests.includes(name)) {
      setSelectedSubDests(selectedSubDests.filter(d => d !== name));
    } else {
      setSelectedSubDests([...selectedSubDests, name]);
    }
  };

  const toggleHotel = (hotel) => {
    if (selectedHotels.some(h => h.id === hotel.id)) {
      setSelectedHotels(selectedHotels.filter(h => h.id !== hotel.id));
    } else {
      setSelectedHotels([...selectedHotels, hotel]);
    }
  };

  const toggleActivity = (activity) => {
    if (selectedActivities.some(a => a.id === activity.id)) {
      setSelectedActivities(selectedActivities.filter(a => a.id !== activity.id));
    } else {
      setSelectedActivities([...selectedActivities, activity]);
    }
  };

  const toggleTransfer = (transfer) => {
    if (selectedTransfers.some(t => t.id === transfer.id)) {
      setSelectedTransfers(selectedTransfers.filter(t => t.id !== transfer.id));
    } else {
      setSelectedTransfers([...selectedTransfers, transfer]);
    }
  };

  const handleComposeWithAI = async () => {
    const primarySub = selectedSubDests[0] || proposalDestination || 'Destination';
    setIsComposing(true);

    try {
      const res = await fetch('/api/generate-day-module', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('voyanta_token') || ''}`
        },
        body: JSON.stringify({
          sub_destination: primarySub,
          day_number: dayNumber,
          selected_hotels: selectedHotels,
          selected_activities: selectedActivities,
          selected_sub_destinations: selectedSubDests,
          notes: curatorNotes
        })
      });

      let dayModule = null;
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.day_module) {
          dayModule = data.day_module;
        }
      }

      if (!dayModule) {
        // High fidelity fallback
        dayModule = {
          title: `Day ${dayNumber}: Exploring ${primarySub}`,
          description: `Enjoy a curated experience in ${primarySub} with tailored accommodations and signature excursions.`,
          sub_destination: primarySub
        };
      }

      // Build rich content blocks from selections
      const contentBlocks = [];

      // Add Heading
      contentBlocks.push({
        id: crypto.randomUUID(),
        type: 'heading',
        data: { text: `Day ${dayNumber} Itinerary Highlights` }
      });

      // Add Narrative Text
      if (dayModule.description) {
        contentBlocks.push({
          id: crypto.randomUUID(),
          type: 'text',
          data: { text: dayModule.description }
        });
      }

      // Add Selected Hotels
      selectedHotels.forEach(h => {
        contentBlocks.push({
          id: crypto.randomUUID(),
          type: 'hotel',
          data: {
            rawItem: h,
            name: h.name,
            details: `${h.location || primarySub} · ${h.category || '4 Star'}`,
            price: Number(h.price_per_night || h.price || 0),
            image_url: h.cover_image || h.image_url || ''
          }
        });
      });

      // Add Selected Activities
      selectedActivities.forEach(a => {
        contentBlocks.push({
          id: crypto.randomUUID(),
          type: 'activity',
          data: {
            rawItem: a,
            name: a.name,
            details: `${a.location || primarySub} · ${a.duration || '2-3 Hours'}`,
            price: Number(a.price || 0),
            image_url: a.cover_image || a.image_url || ''
          }
        });
      });

      // Add Selected Transfers
      selectedTransfers.forEach(t => {
        contentBlocks.push({
          id: crypto.randomUUID(),
          type: 'transfer',
          data: {
            rawItem: t,
            name: t.name || t.vehicle_type || 'Private AC Transfer',
            details: `${t.vehicle_type || 'Sedan'} · Dedicated Driver`,
            price: Number(t.price || 0)
          }
        });
      });

      // Deliver to parent
      const assembledResult = {
        title: dayModule.title || `Day ${dayNumber}: Exploring ${primarySub}`,
        description: dayModule.description || '',
        sub_destination: primarySub,
        content: contentBlocks
      };

      const allSelectedRawItems = [
        ...selectedHotels.map(h => ({ item: h, kind: 'hotel' })),
        ...selectedActivities.map(a => ({ item: a, kind: 'activity' })),
        ...selectedTransfers.map(t => ({ item: t, kind: 'transfer' }))
      ];

      onAssemble(assembledResult, allSelectedRawItems);
      toast.success(`Day ${dayNumber} composed successfully!`);
      onClose();
    } catch (err) {
      console.error('Day assembly failed:', err);
      toast.error('Failed to compose day module.');
    } finally {
      setIsComposing(false);
    }
  };

  const handleAddDirectly = () => {
    const primarySub = selectedSubDests[0] || proposalDestination || 'Destination';
    const contentBlocks = [];

    // Add Selected Hotels
    selectedHotels.forEach(h => {
      contentBlocks.push({
        id: crypto.randomUUID(),
        type: 'hotel',
        data: {
          rawItem: h,
          name: h.name,
          details: `${h.location || primarySub} · ${h.category || '4 Star'}`,
          price: Number(h.price_per_night || h.price || 0),
          image_url: h.cover_image || h.image_url || ''
        }
      });
    });

    // Add Selected Activities
    selectedActivities.forEach(a => {
      contentBlocks.push({
        id: crypto.randomUUID(),
        type: 'activity',
        data: {
          rawItem: a,
          name: a.name,
          details: `${a.location || primarySub} · ${a.duration || '2-3 Hours'}`,
          price: Number(a.price || 0),
          image_url: a.cover_image || a.image_url || ''
        }
      });
    });

    // Add Selected Transfers
    selectedTransfers.forEach(t => {
      contentBlocks.push({
        id: crypto.randomUUID(),
        type: 'transfer',
        data: {
          rawItem: t,
          name: t.name || t.vehicle_type || 'Private AC Transfer',
          details: `${t.vehicle_type || 'Sedan'} · Dedicated Driver`,
          price: Number(t.price || 0)
        }
      });
    });

    const assembledResult = {
      title: `Day ${dayNumber}: Exploring ${primarySub}`,
      description: `Curated excursion in ${primarySub}.`,
      sub_destination: primarySub,
      content: contentBlocks
    };

    const allSelectedRawItems = [
      ...selectedHotels.map(h => ({ item: h, kind: 'hotel' })),
      ...selectedActivities.map(a => ({ item: a, kind: 'activity' })),
      ...selectedTransfers.map(t => ({ item: t, kind: 'transfer' }))
    ];

    onAssemble(assembledResult, allSelectedRawItems);
    toast.success(`Day ${dayNumber} items added directly!`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface border border-outline-variant text-on-surface rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-high flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary font-mono">
                Day {dayNumber} Planner & Curator Assistant
              </span>
              <h2 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                Assemble Day {dayNumber} ({proposalDestination || 'Trip'})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-container-lowest">
            {/* Step 1: Sub-Destinations */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">location_on</span>
                1. Select Sub-Destination(s) for Day {dayNumber}
              </label>
              <div className="flex flex-wrap gap-2">
                {subDestCandidates.length > 0 ? (
                  subDestCandidates.map(sd => {
                    const isSelected = selectedSubDests.includes(sd);
                    return (
                      <button
                        key={sd}
                        type="button"
                        onClick={() => toggleSubDest(sd)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-primary text-on-primary border-primary shadow-sm'
                            : 'bg-surface border-outline-variant text-on-surface hover:border-primary/50'
                        }`}
                      >
                        {isSelected ? (
                          <span className="material-symbols-outlined text-[14px]">check</span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        )}
                        <span>{sd}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-on-surface-variant italic">
                    No sub-destinations discovered for {proposalDestination}.
                  </p>
                )}
              </div>
            </div>

            {/* Step 2: Accommodations / Hotels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">hotel</span>
                  2. Select Accommodation ({filteredHotels.length} available)
                </label>
                <span className="text-[11px] text-on-surface-variant">
                  {selectedHotels.length} selected
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                {filteredHotels.length > 0 ? (
                  filteredHotels.map(h => {
                    const isSelected = selectedHotels.some(item => item.id === h.id);
                    return (
                      <div
                        key={h.id}
                        onClick={() => toggleHotel(h)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-sm'
                            : 'bg-surface border-outline-variant hover:border-primary/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-on-surface truncate">{h.name}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {h.location || proposalDestination} · {h.category || '4 Star'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            ₹{Number(h.price_per_night || h.price || 0).toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isSelected ? 'text-primary' : 'text-on-surface-variant/40'
                            }`}
                          >
                            {isSelected ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-on-surface-variant italic col-span-2 p-2 bg-surface rounded-xl border border-outline-variant text-center">
                    No matching hotels in vault library for this location.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Activities & Attractions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">local_activity</span>
                  3. Select Activities & Excursions ({filteredActivities.length} available)
                </label>
                <span className="text-[11px] text-on-surface-variant">
                  {selectedActivities.length} selected
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map(a => {
                    const isSelected = selectedActivities.some(item => item.id === a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => toggleActivity(a)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-sm'
                            : 'bg-surface border-outline-variant hover:border-primary/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-on-surface truncate">{a.name}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {a.location || proposalDestination} · {a.duration || '2-3 Hours'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            ₹{Number(a.price || 0).toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isSelected ? 'text-primary' : 'text-on-surface-variant/40'
                            }`}
                          >
                            {isSelected ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-on-surface-variant italic col-span-2 p-2 bg-surface rounded-xl border border-outline-variant text-center">
                    No matching activities in vault library for this location.
                  </p>
                )}
              </div>
            </div>

            {/* Optional Curator Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Curator Instructions for Day {dayNumber} (Optional)
              </label>
              <input
                type="text"
                placeholder='e.g. "Early morning sunrise viewpoint, then relaxed afternoon shopping"'
                value={curatorNotes}
                onChange={e => setCuratorNotes(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-high flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddDirectly}
                disabled={isComposing || (selectedHotels.length === 0 && selectedActivities.length === 0 && selectedSubDests.length === 0)}
                className="px-4 py-2 text-xs font-bold bg-surface border border-outline-variant hover:bg-surface-container text-on-surface rounded-xl transition-all disabled:opacity-40"
              >
                Add Blocks Directly
              </button>

              <button
                type="button"
                onClick={handleComposeWithAI}
                disabled={isComposing}
                className="px-5 py-2 text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isComposing ? (
                  <>
                    <FlyingLoader size="text-[16px]" />
                    <span>Composing Day {dayNumber} with AI...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    <span>Compose Day {dayNumber} with AI ✦</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
