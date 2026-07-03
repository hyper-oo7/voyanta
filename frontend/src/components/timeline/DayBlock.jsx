import { useState, memo } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableContentBlock from '../itinerary/SortableContentBlock.jsx';
import ResourcePickerModal from '../itinerary/ResourcePickerModal.jsx';

export const DayBlock = memo(function DayBlock({ dayData, index, updateDay, removeDay, items = [], onRemoveItem, onAddResourceItem }) {
  const upd = (key) => (e) => updateDay(index, { [key]: e.target.value });
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [pickerType, setPickerType] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addContentBlock = (type, presetData = {}) => {
    let defaultData = { ...presetData };
    if (type === 'heading') defaultData = { text: 'New Heading', ...presetData };
    if (type === 'text') defaultData = { text: '', ...presetData };
    if (type === 'image') defaultData = { url: '', ...presetData };
    if (type === 'gallery') defaultData = { urls: '', ...presetData };
    if (type === 'hotel') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'activity') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'flight') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'transfer') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'meals') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'cruise') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'destination') defaultData = { name: '', details: '', image_url: '', ...presetData };
    if (type === 'custom') defaultData = { name: '', details: '', image_url: '', ...presetData };

    const newBlock = { id: crypto.randomUUID(), type, data: defaultData };
    const currentContent = Array.isArray(dayData.content) ? [...dayData.content] : [];
    updateDay(index, { content: [...currentContent, newBlock] });
    setShowBlockMenu(false);
  };

  const updateContentBlock = (blockId, newData) => {
    const currentContent = Array.isArray(dayData.content) ? [...dayData.content] : [];
    const nextContent = currentContent.map(b => b.id === blockId ? { ...b, data: newData } : b);
    updateDay(index, { content: nextContent });
  };

  const removeContentBlock = (blockId) => {
    const currentContent = Array.isArray(dayData.content) ? [...dayData.content] : [];
    const nextContent = currentContent.filter(b => b.id !== blockId);
    updateDay(index, { content: nextContent });
  };

  const handleDragEndContent = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const currentContent = Array.isArray(dayData.content) ? [...dayData.content] : [];
      const oldIndex = currentContent.findIndex((item) => item.id === active.id);
      const newIndex = currentContent.findIndex((item) => item.id === over.id);
      updateDay(index, { content: arrayMove(currentContent, oldIndex, newIndex) });
    }
  };

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
        
        {/* Rich Content Blocks */}
        <div className="pt-md border-t border-outline-variant/50 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="font-label-sm text-on-surface-variant uppercase tracking-widest">Rich Content Blocks</h5>
            <div className="relative">
              <button 
                onClick={() => setShowBlockMenu(!showBlockMenu)}
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Add Block
              </button>

              {showBlockMenu && (
                <div className="absolute bottom-full right-0 mb-1 w-56 bg-white border border-outline-variant rounded-xl shadow-xl z-[200] max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest border-b border-outline-variant/50">Basic Blocks</div>
                  <div className="p-1">
                    <BlockMenuItem icon="title" label="Heading" onClick={() => addContentBlock('heading')} />
                    <BlockMenuItem icon="notes" label="Text" onClick={() => addContentBlock('text')} />
                    <BlockMenuItem icon="image" label="Image" onClick={() => addContentBlock('image')} />
                    <BlockMenuItem icon="photo_library" label="Gallery" onClick={() => addContentBlock('gallery')} />
                  </div>
                  <div className="p-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest border-b border-t border-outline-variant/50">Travel Elements</div>
                  <div className="p-1">
                    <BlockMenuItem icon="hotel" label="Hotel" onClick={() => { setPickerType('hotel'); setShowBlockMenu(false); }} />
                    <BlockMenuItem icon="local_activity" label="Activity" onClick={() => { setPickerType('activity'); setShowBlockMenu(false); }} />
                    <BlockMenuItem icon="flight" label="Flight" onClick={() => { setPickerType('flight'); setShowBlockMenu(false); }} />
                    <BlockMenuItem icon="directions_car" label="Transfer" onClick={() => addContentBlock('transfer')} />
                    <BlockMenuItem icon="restaurant" label="Meals" onClick={() => addContentBlock('meals')} />
                    <BlockMenuItem icon="directions_boat" label="Cruise / Ferry" onClick={() => addContentBlock('cruise')} />
                    <BlockMenuItem icon="location_on" label="Destination Overview" onClick={() => addContentBlock('destination')} />
                    <BlockMenuItem icon="dashboard" label="Custom Card" onClick={() => addContentBlock('custom')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {(dayData.content || []).length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndContent}>
              <SortableContext items={(dayData.content || []).map(c => c.id)} strategy={verticalListSortingStrategy}>
                {(dayData.content || []).map(item => (
                  <SortableContentBlock 
                    key={item.id} 
                    id={item.id} 
                    item={item} 
                    onChange={updateContentBlock}
                    onRemove={removeContentBlock}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-4 border border-dashed border-outline-variant/60 rounded-xl text-on-surface-variant/60 text-xs">
              No rich content blocks added yet. Click "+ Add Block" above or use the library sidebar.
            </div>
          )}
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

      {pickerType && (
        <ResourcePickerModal 
          type={pickerType} 
          onSelect={(data) => {
            if (onAddResourceItem && data.rawItem) {
              onAddResourceItem(data.rawItem, pickerType, index);
            } else {
              addContentBlock(pickerType, data);
            }
            setPickerType(null);
          }} 
          onClose={() => setPickerType(null)} 
        />
      )}
    </div>
  );
});

function BlockMenuItem({ icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-container-low text-on-surface transition-colors text-left"
    >
      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{icon}</span>
      <span className="font-semibold text-xs">{label}</span>
    </button>
  );
}
