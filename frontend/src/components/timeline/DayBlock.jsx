import { memo } from 'react';
import LogoUploader from '../LogoUploader.jsx';

export const DayBlock = memo(function DayBlock({ dayData, index, updateDay, removeDay, items = [], onRemoveItem }) {
  const upd = (key) => (e) => updateDay(index, { [key]: e.target.value });

  return (
    <div className="relative pl-xl py-md group" data-testid={`day-block-${index}`}>
      {/* Timeline spine */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-outline-variant transform translate-x-[23px]"></div>
      
      {/* Day node marker */}
      <div className="absolute left-0 top-10 transform translate-x-[16px] w-4 h-4 rounded-full bg-primary ring-4 ring-surface-container-lowest z-10 transition-transform group-hover:scale-125"></div>
      
      <div className="glass-card rounded-2xl p-lg space-y-md border border-outline-variant/50 bg-white/80 backdrop-blur-xl shadow-sm transition-all hover:shadow-md">
        <div className="flex justify-between items-start gap-md">
          <div className="flex-1 space-y-xs">
            <span className="font-label-sm text-primary font-bold tracking-widest uppercase block">Day {dayData.day || index + 1}</span>
            <input 
              value={dayData.title || ''} 
              onChange={upd('title')} 
              placeholder="e.g. Arrival & Welcome to the Amalfi Coast"
              className="w-full font-headline-sm text-on-surface font-bold bg-transparent border-b-2 border-transparent hover:border-outline-variant focus:border-primary outline-none transition-colors py-xs"
            />
          </div>
          <button onClick={() => removeDay(index)} title="Remove Day" data-testid={`remove-day-${index}`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors opacity-0 group-hover:opacity-100">
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg pt-sm">
          <div className="lg:col-span-2">
            <textarea 
              value={dayData.description || ''} 
              onChange={upd('description')} 
              placeholder="Describe the magical experiences planned for this day in an editorial style..."
              rows={5}
              className="w-full h-full p-md bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div className="lg:col-span-1 min-w-0 flex flex-col">
            <LogoUploader 
              value={dayData.image_url} 
              onChange={(url) => updateDay(index, { image_url: url })} 
              label="Day Cover Photo" 
              folder="itineraries" 
            />
          </div>
        </div>

        {/* Nested Items */}
        {items.length > 0 && (
          <div className="pt-md border-t border-outline-variant/50 mt-md space-y-xs">
            <h5 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Added to Day {dayData.day || index + 1}</h5>
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg p-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    {item.kind === 'hotel' ? 'hotel' : item.kind === 'flight' ? 'flight' : 'tour'}
                  </span>
                  <span className="font-label-md text-on-surface">{item.label}</span>
                </div>
                {onRemoveItem && (
                  <button onClick={() => onRemoveItem(item.id)} className="text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
