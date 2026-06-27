import { useCallback } from 'react';
import { DayBlock } from '../../components/timeline/DayBlock.jsx';
import { AISidebar } from '../../components/timeline/AISidebar.jsx';

export function Step2Itinerary({ proposal, setProposal, itineraries, onApplyItinerary, client }) {
  
  const days = proposal?.itinerary?.days || [];

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
      // Re-number days
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
            <p className="text-xs text-on-surface-variant mt-sm">Select an itinerary from your library to instantly populate the day-by-day schedule below.</p>
          </div>
        </div>
        
        <div className="space-y-sm pt-md">
          {days.length === 0 && (
            <div className="text-center py-xl border-2 border-dashed border-outline-variant rounded-2xl text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] mb-md opacity-50">timeline</span>
              <p className="font-label-md">No days added yet.</p>
              <p className="font-body-sm text-sm mb-md">Import a reference itinerary or add your first day below.</p>
            </div>
          )}

          {days.map((dayData, i) => (
            <DayBlock 
              key={i} 
              index={i} 
              dayData={dayData} 
              updateDay={updateDay} 
              removeDay={removeDay} 
            />
          ))}

          <div className="pl-xl pt-lg pb-xl">
             <button onClick={addDay} className="flex items-center gap-xs px-xl py-md bg-surface-container-highest text-primary font-label-md rounded-full hover:bg-primary hover:text-on-primary transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">add</span>
                Add Day {days.length + 1}
             </button>
          </div>
        </div>
      </div>

      {/* Right Column: AI Sidebar */}
      <div className="lg:col-span-4 relative">
        <AISidebar destination={client.destination} budget={client.budget} />
      </div>

    </div>
  );
}
