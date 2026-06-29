import { useCallback, useState, useEffect } from 'react';
import { DayBlock } from '../../components/timeline/DayBlock.jsx';
import { hotelsService, flightsService, activitiesService } from '../../services/resourceService.js';
import { addItem, removeItem } from '../../services/proposalItemService.js';
import { useToast } from '../../context/ToastContext.jsx';

export function Step2Itinerary({ proposal, setProposal, itineraries, onApplyItinerary, client, items, setItems, proposalCurrency }) {
  const toast = useToast();
  const days = proposal?.itinerary?.days || [];
  
  const [activeTab, setActiveTab] = useState('itinerary');
  const [libraryData, setLibraryData] = useState({ hotels: [], flights: [], itinerary: [] });
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      hotelsService.list(),
      flightsService.list(),
      activitiesService.list()
    ]).then(([h, f, e]) => {
      setLibraryData({ hotels: h, flights: f, itinerary: e });
    }).catch(err => console.error(err));
  }, []);

  const updateDay = useCallback((index, patch) => {
    setProposal(prev => {
      const nextDays = [...(prev.itinerary?.days || [])];
      nextDays[index] = { ...nextDays[index], ...patch };
      return { ...prev, itinerary: { ...prev.itinerary, days: nextDays } };
    });
  }, [setProposal]);

  const removeDay = useCallback((index) => {
    if (!window.confirm('Are you sure you want to remove this day?')) return;
    setProposal(prev => {
      const nextDays = [...(prev.itinerary?.days || [])];
      nextDays.splice(index, 1);
      nextDays.forEach((d, i) => d.day = i + 1);
      return { ...prev, itinerary: { ...prev.itinerary, days: nextDays } };
    });
  }, [setProposal]);

  const addDay = useCallback(() => {
    setProposal(prev => {
      const nextDays = [...(prev.itinerary?.days || [])];
      nextDays.push({
        day: nextDays.length + 1,
        title: '',
        description: '',
        image_url: null
      });
      return { ...prev, itinerary: { ...prev.itinerary, days: nextDays } };
    });
  }, [setProposal]);

  // Inventory handling
  const defaultQtyFor = (kind) => {
    const travelers = (parseInt(client.num_adults, 10) || 0) + (parseInt(client.num_children, 10) || 0) || 1;
    if (kind === 'hotel') return 1; // 1 room default, nights handled in costing usually
    return travelers;
  };

  const onAddItemToDay = async (resourceItem, kind, dayIndex) => {
    if (!proposal?.id) { toast.error('Save the client info first'); return; }
    
    let label = '';
    let price = 0;
    
    if (kind === 'hotel') { label = resourceItem.name; price = Number(resourceItem.price_per_night||0); }
    else if (kind === 'flight') { label = `${resourceItem.airline||'Flight'} ${resourceItem.flight_no||''} ${resourceItem.origin||''}→${resourceItem.destination||''}`.trim(); price = Number(resourceItem.cost||0); }
    else if (kind === 'activity') { label = resourceItem.name; price = Number(resourceItem.price||0); }

    try {
      const newItem = await addItem(proposal.id, {
        kind, ref_id: resourceItem.id, label,
        qty: defaultQtyFor(kind), unit_price: price,
        currency: resourceItem.currency || 'INR',
        meta: { source: kind + 's', day: dayIndex + 1 }
      });
      setItems(s => [...s, newItem]);
      toast.success(`Added ${label} to Day ${dayIndex + 1}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onRemoveProposalItem = async (itemId) => {
    try { 
      await removeItem(itemId); 
      setItems(s => s.filter(x => x.id !== itemId)); 
      toast.success('Removed item'); 
    } catch (e) { toast.error(e.message); }
  };

  const filteredItems = libraryData[activeTab].filter(item => {
    const term = search.toLowerCase();
    if (activeTab === 'hotels') return item.name?.toLowerCase().includes(term) || item.location?.toLowerCase().includes(term);
    if (activeTab === 'flights') return item.airline?.toLowerCase().includes(term) || item.flight_no?.toLowerCase().includes(term);
    if (activeTab === 'itinerary') return item.name?.toLowerCase().includes(term) || item.location?.toLowerCase().includes(term);
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl relative items-start" data-testid="step-2">
      
      {/* Left Column: Timeline Builder */}
      <div className="lg:col-span-8 min-w-0 space-y-xl">
        <div className="glass-card rounded-2xl p-lg space-y-md border border-outline-variant/50">
          <h3 className="font-headline-sm text-primary">Proposal Itinerary</h3>
          <div>
            <label className="font-label-md text-on-surface block mb-xs font-semibold">Reference Itinerary</label>
            <select value={client.itinerary_id || ''} onChange={(e) => onApplyItinerary(e.target.value)} data-testid="ref-itinerary"
              className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md focus:border-primary transition-colors">
              <option value="">— Start from Scratch —</option>
              {itineraries.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.destination || 'No location'})</option>)}
            </select>
          </div>
        </div>
        
        <div className="space-y-sm pt-md">
          {days.length === 0 && (
            <div className="text-center py-xl border-2 border-dashed border-outline-variant rounded-2xl text-on-surface-variant bg-white/50">
              <span className="material-symbols-outlined text-[48px] mb-md opacity-50">timeline</span>
              <p className="font-label-md">No days added yet.</p>
              <p className="font-body-sm text-sm mb-md">Import a reference itinerary or add your first day below.</p>
            </div>
          )}

          {days.map((dayData, i) => {
            const dayItems = items.filter(it => it.meta?.day === i + 1);
            return (
              <DayBlock 
                key={i} 
                index={i} 
                dayData={dayData} 
                updateDay={updateDay} 
                removeDay={removeDay}
                items={dayItems}
                onRemoveItem={onRemoveProposalItem}
              />
            );
          })}

          <div className="pl-xl pt-lg pb-xl">
             <button onClick={addDay} className="flex items-center gap-xs px-xl py-md bg-surface-container-highest text-primary font-label-md rounded-full hover:bg-primary hover:text-on-primary transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">add</span>
                Add Day {days.length + 1}
             </button>
          </div>
        </div>
      </div>

      {/* Right Column: Inventory Library Sidebar */}
      <div className="lg:col-span-4 sticky top-6 space-y-md h-[calc(100vh-120px)] flex flex-col">
        <div className="glass-card rounded-2xl border border-outline-variant/50 overflow-hidden flex flex-col h-full shadow-lg">
          <div className="p-md border-b border-outline-variant/50 bg-white/50 backdrop-blur-md">
            <h4 className="font-label-md text-on-surface uppercase tracking-widest mb-sm">Library</h4>
            <div className="flex bg-surface-container rounded-lg p-1">
              <button onClick={() => setActiveTab('itinerary')} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'itinerary' ? 'bg-white shadow text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Itinerary</button>
              <button onClick={() => setActiveTab('hotels')} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'hotels' ? 'bg-white shadow text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Hotels</button>
              <button onClick={() => setActiveTab('flights')} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'flights' ? 'bg-white shadow text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Flights</button>
            </div>
            <div className="mt-sm relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} 
                className="w-full pl-xl pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-md space-y-sm bg-gradient-to-b from-white/50 to-transparent">
            {filteredItems.length === 0 && <p className="text-center text-sm text-on-surface-variant mt-md">No items found.</p>}
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-all group">
                <p className="font-label-md text-on-surface">{activeTab === 'flights' ? `${item.airline} ${item.flight_no}` : item.name}</p>
                <p className="text-xs text-on-surface-variant truncate">
                  {activeTab === 'hotels' && item.location}
                  {activeTab === 'flights' && `${item.origin} → ${item.destination}`}
                  {activeTab === 'itinerary' && item.location}
                </p>
                <div className="mt-sm pt-sm border-t border-outline-variant/50">
                  <select 
                    className="w-full text-xs py-1 px-2 bg-surface-container rounded border-none focus:ring-1 focus:ring-primary cursor-pointer text-primary font-medium"
                    onChange={(e) => {
                      if(e.target.value) {
                        onAddItemToDay(item, activeTab === 'itinerary' ? 'activity' : (activeTab === 'hotels' ? 'hotel' : 'flight'), parseInt(e.target.value));
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Add to Day...</option>
                    {days.map((d, i) => (
                      <option key={i} value={i}>Day {d.day}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
