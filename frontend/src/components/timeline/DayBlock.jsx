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
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import ImageSearchPicker from '../common/ImageSearchPicker.jsx';
import { uploadOrEmbed } from '../LogoUploader.jsx';

export const DayBlock = memo(function DayBlock({ dayData, index, updateDay, removeDay, items = [], onRemoveItem, onAddResourceItem, proposalDestination, tourType }) {
  const toast = useToast();
  const upd = (key) => (e) => updateDay(index, { [key]: e.target.value });
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [showDayImagePicker, setShowDayImagePicker] = useState(false);

  const dayImages = Array.isArray(dayData.images) && dayData.images.length > 0
    ? dayData.images
    : (Array.isArray(dayData.photos) && dayData.photos.length > 0
      ? dayData.photos
      : (dayData.image_url ? [dayData.image_url] : []));

  const addDayImage = (url) => {
    if (!url) return;
    const next = [...dayImages, url];
    updateDay(index, { images: next, photos: next, image_url: next[0] });
  };

  const removeDayImage = (imgIdx) => {
    const next = dayImages.filter((_, i) => i !== imgIdx);
    updateDay(index, { images: next, photos: next, image_url: next[0] || null });
  };
  
  // AI Expansion states
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiLength, setAiLength] = useState('medium');
  const [aiFormat, setAiFormat] = useState('paragraph');
  const [isExpanding, setIsExpanding] = useState(false);

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
            <div className="pt-2 space-y-1">
              <div className="flex flex-col gap-2 p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Day Experience & Narrative</span>
                  {!showAIPanel && (
                    <button
                      type="button"
                      onClick={() => setShowAIPanel(true)}
                      title="VI Expand Luxury Experience"
                      className="inline-flex items-center justify-center w-7 h-7 bg-primary text-white hover:bg-primary/90 rounded-full transition-all border-none cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                    </button>
                  )}
                </div>

                {showAIPanel && (
                  <div className="space-y-3 pt-1 border-t border-outline-variant/40 animate-fade-in text-xs font-sans text-on-surface">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Response Length</label>
                        <select 
                          value={aiLength} 
                          onChange={(e) => setAiLength(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                        >
                          <option value="brief">Brief (essentials only)</option>
                          <option value="medium">Medium (place & feeling)</option>
                          <option value="detailed">Detailed (multi-paragraph)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Text Style</label>
                        <select 
                          value={aiFormat} 
                          onChange={(e) => setAiFormat(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                        >
                          <option value="paragraph">Paragraphs</option>
                          <option value="bullet points">Bullet Points</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
                      <button 
                        type="button" 
                        onClick={() => setShowAIPanel(false)}
                        className="px-2.5 py-1 text-[10px] font-bold text-on-surface-variant bg-surface hover:bg-surface-container border border-outline-variant rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        disabled={isExpanding}
                        onClick={async () => {
                          const txt = dayData.description || dayData.title || '';
                          if (!txt) {
                            toast.info('Please enter a brief day title or description first.');
                            return;
                          }
                          setIsExpanding(true);
                          toast.info('Expanding day into luxury experience via VI...');
                          try {
                            const res = await api.post('/api/enhance-text', {
                              text: txt,
                              mode: 'day_description',
                              destination: proposalDestination || dayData.title || '',
                              length: aiLength,
                              format: aiFormat,
                              tier: tourType
                            });
                            if (res?.enhanced_text) {
                              updateDay(index, { description: res.enhanced_text });
                              toast.success('Day expanded beautifully!');
                              setShowAIPanel(false);
                            }
                          } catch (e) {
                            toast.error('AI expansion failed');
                          } finally {
                            setIsExpanding(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-primary hover:bg-primary/95 px-3 py-1 border-none rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isExpanding ? 'Expanding...' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <textarea
                value={dayData.description || ''}
                onChange={upd('description')}
                placeholder="Describe the day's luxury itinerary, private chauffeur transfers, VIP reservations, and sensory atmosphere..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm focus:ring-2 focus:ring-primary/20"
              />

              {/* Day Header & Carousel Images UI */}
              <div className="pt-3 mt-3 border-t border-outline-variant/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">collections</span>
                    Day Header & Carousel Images ({dayImages.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDayImagePicker(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                    + Add Carousel Image
                  </button>
                </div>
                {dayImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {dayImages.map((imgUrl, i) => (
                      <div key={i} className="relative aspect-video rounded-xl overflow-hidden group/day-img border border-outline-variant shadow-xs bg-surface-variant">
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase">
                          {i === 0 ? 'Cover' : `#${i + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDayImage(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover/day-img:opacity-100 hover:bg-error transition-all cursor-pointer border-none shadow-sm"
                          title="Remove image from carousel"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    onClick={() => setShowDayImagePicker(true)}
                    className="w-full py-4 border-2 border-dashed border-outline-variant/60 rounded-xl flex flex-col items-center justify-center gap-1 text-on-surface-variant/60 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-xs font-semibold"
                  >
                    <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                    Click to add header / carousel images for Day {dayData.day || index + 1}
                  </div>
                )}
              </div>
            </div>
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
          destination={proposalDestination}
          subDestination={dayData?.sub_destination || dayData?.title || ''}
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

      {showDayImagePicker && (
        <ImageSearchPicker
          onSelect={(url) => {
            addDayImage(url);
            setShowDayImagePicker(false);
          }}
          onClose={() => setShowDayImagePicker(false)}
          defaultQuery={dayData.title || proposalDestination || 'luxury resort tour'}
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
