import { memo } from 'react';

export const STEPS = [
  { n: 1, key: 'client',    label: 'Client Info' },
  { n: 2, key: 'itinerary', label: 'Itinerary Builder' },
  { n: 3, key: 'costing',   label: 'Costing' },
  { n: 4, key: 'branding',  label: 'Branding' },
  { n: 5, key: 'preview',   label: 'Preview' },
];

export const ProgressBar = memo(function ProgressBar({ step, onJump }) {
  return (
    <div className="glass-card rounded-xl p-md flex items-center gap-xs overflow-x-auto" data-testid="wizard-progress">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-xs flex-shrink-0">
          <button onClick={() => onJump(s.n)} data-testid={`step-${s.n}`}
            className={'px-md py-xs rounded-full font-label-sm transition-all ' +
              (step === s.n ? 'bg-primary text-on-primary' :
               step > s.n  ? 'bg-surface-container-highest text-primary' :
                             'bg-surface-container-low text-on-surface-variant')}>
            <span className="material-symbols-outlined text-[14px] mr-xs align-middle">{step > s.n ? 'check' : 'circle'}</span>
            {s.n}. {s.label}
          </button>
          {i < STEPS.length - 1 && <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>}
        </div>
      ))}
    </div>
  );
});
