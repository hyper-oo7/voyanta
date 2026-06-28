import { memo } from 'react';

export const AISidebar = memo(function AISidebar({ destination, budget }) {
  return (
    <div className="glass-card rounded-2xl p-lg sticky top-[100px] max-h-[calc(100vh-140px)] overflow-y-auto space-y-md border-t-4 border-t-tertiary shadow-lg">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-tertiary text-[24px]">auto_awesome</span>
        <h3 className="font-headline-sm text-primary">Intelligence</h3>
      </div>
      
      <p className="font-body-sm text-on-surface-variant border-b border-outline-variant pb-md">
        Contextual recommendations curated for {destination ? <strong className="text-on-surface">{destination}</strong> : 'the selected destination'}.
      </p>

      <div className="space-y-sm pt-xs">
        <h4 className="font-label-sm uppercase tracking-widest text-on-surface-variant">Suggested Hotels</h4>
        <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50 hover:border-tertiary/50 transition-colors group">
          <p className="font-label-md text-on-surface font-bold group-hover:text-tertiary transition-colors">Grand Hotel Excelsior</p>
          <p className="font-body-sm text-on-surface-variant mt-xs">5-star luxury cliffside views.</p>
          <button className="mt-sm text-tertiary font-label-sm hover:underline flex items-center gap-xs" onClick={() => alert('Quick Add coming soon!')}>
            <span className="material-symbols-outlined text-[16px]">add</span> Add to Proposal
          </button>
        </div>
        <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50 hover:border-tertiary/50 transition-colors group">
          <p className="font-label-md text-on-surface font-bold group-hover:text-tertiary transition-colors">Villa Franca</p>
          <p className="font-body-sm text-on-surface-variant mt-xs">Boutique experience in town center.</p>
          <button className="mt-sm text-tertiary font-label-sm hover:underline flex items-center gap-xs" onClick={() => alert('Quick Add coming soon!')}>
             <span className="material-symbols-outlined text-[16px]">add</span> Add to Proposal
          </button>
        </div>
      </div>

      <div className="space-y-sm pt-sm">
        <h4 className="font-label-sm uppercase tracking-widest text-on-surface-variant">Popular Itinerary</h4>
        <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50 hover:border-tertiary/50 transition-colors group">
          <p className="font-label-md text-on-surface font-bold group-hover:text-tertiary transition-colors">Private Boat Tour</p>
          <p className="font-body-sm text-on-surface-variant mt-xs">Full day Capri excursion.</p>
          <button className="mt-sm text-tertiary font-label-sm hover:underline flex items-center gap-xs" onClick={() => alert('Quick Add coming soon!')}>
             <span className="material-symbols-outlined text-[16px]">add</span> Add to Proposal
          </button>
        </div>
      </div>
      
      <div className="mt-xl p-md bg-tertiary/10 rounded-xl border border-tertiary/20">
        <p className="font-label-sm text-tertiary text-center flex items-center justify-center gap-xs">
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          Real-time LLM connects in Phase 7
        </p>
      </div>
    </div>
  );
});
