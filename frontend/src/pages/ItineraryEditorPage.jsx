import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ResourcePickerModal from '../components/itinerary/ResourcePickerModal.jsx';
import LogoUploader, { uploadOrEmbed } from '../components/LogoUploader.jsx';
import SortableContentBlock from '../components/itinerary/SortableContentBlock.jsx';

function SortableDayItem({ id, block, isActive, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const getDayIcon = () => {
    switch (block.block_type) {
      case 'arrival': return 'flight_land';
      case 'departure': return 'flight_takeoff';
      default: return 'wb_sunny';
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`group flex items-center justify-between p-sm rounded-lg mb-1 cursor-pointer transition-all duration-200 border border-transparent ${
        isActive ? 'bg-primary/10 border-primary/20 text-primary font-bold shadow-sm' : 'hover:bg-surface-container text-on-surface-variant'
      } ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <span 
          {...attributes} 
          {...listeners}
          className="material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-on-surface-variant/50 hover:text-on-surface-variant transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          drag_indicator
        </span>
        <span className="material-symbols-outlined text-[18px] opacity-80 flex-shrink-0 text-primary/70">
          {getDayIcon()}
        </span>
        <span className="truncate text-sm">{block.title || `Day ${block.day_number}`}</span>
      </div>
      {block.block_type === 'day' && (
        <span className="text-xs bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded font-mono">D{block.day_number}</span>
      )}
    </div>
  );
}

export default function ItineraryEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [itinerary, setItinerary] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeDayId, setActiveDayId] = useState(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [viewMode, setViewMode] = useState('days'); // 'days' | 'checklists'
  const [pickerType, setPickerType] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    try {
      const data = await itinerariesService.get(id);
      const b = await itineraryBlocksService.list({ itinerary_id: id });
      
      // Ensure content is parsed if it's a string (though jsonb should be object)
      const parsedBlocks = b.map(block => ({
        ...block,
        content: typeof block.content === 'string' ? JSON.parse(block.content) : (block.content || [])
      })).sort((a, c) => (a.position || 0) - (c.position || 0));

      setItinerary({
        ...data,
        included_items: data.included_items || [],
        excluded_items: data.excluded_items || []
      });
      setBlocks(parsedBlocks);
      if (parsedBlocks.length > 0 && !activeDayId) {
        setActiveDayId(parsedBlocks[0].id);
      }
    } catch (e) {
      toast.error('Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  }, [id, activeDayId, toast]);

  useEffect(() => { load(); }, [load]);

  const saveDayContent = (dayId, newContent) => {
    setBlocks(prev => prev.map(b => b.id === dayId ? { ...b, content: newContent } : b));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    try {
      if (itinerary) {
        try {
          await itinerariesService.update(itinerary.id, { 
            included_items: itinerary.included_items, 
            excluded_items: itinerary.excluded_items 
          });
        } catch (err) {
          console.warn('Checklists could not be saved due to missing columns, proceeding to save blocks.');
        }
      }

      await Promise.all(blocks.map((b, i) => 
        itineraryBlocksService.update(b.id, { 
          position: i, 
          day_number: b.day_number, 
          title: b.title,
          content: b.content
        })
      ));
      
      setHasUnsavedChanges(false);
      toast.success('Itinerary saved successfully');
    } catch (e) {
      toast.error('Failed to save itinerary');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEndDays = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    const newBlocks = arrayMove(blocks, oldIndex, newIndex);

    // Renumber days
    let dayCount = 1;
    newBlocks.forEach(b => {
      if (b.block_type === 'day') {
        b.day_number = dayCount++;
        if (b.title && b.title.match(/^Day \d+$/)) b.title = `Day ${b.day_number}`;
      }
    });

    setBlocks(newBlocks);
    setHasUnsavedChanges(true);
  };

  const handleDragEndContent = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeBlock = blocks.find(b => b.id === activeDayId);
    if (!activeBlock) return;

    const oldIndex = activeBlock.content.findIndex((c) => c.id === active.id);
    const newIndex = activeBlock.content.findIndex((c) => c.id === over.id);
    const newContent = arrayMove(activeBlock.content, oldIndex, newIndex);

    saveDayContent(activeDayId, newContent);
  };

  const addContentBlock = (type, presetData = {}) => {
    const activeBlock = blocks.find(b => b.id === activeDayId);
    if (!activeBlock) return;

    const newItem = {
      id: crypto.randomUUID(),
      type,
      data: presetData
    };

    const newContent = [...activeBlock.content, newItem];
    saveDayContent(activeDayId, newContent);
    setShowBlockMenu(false);
  };

  const updateContentBlock = (itemId, dataPatch) => {
    const activeBlock = blocks.find(b => b.id === activeDayId);
    if (!activeBlock) return;

    const newContent = activeBlock.content.map(c => 
      c.id === itemId ? { ...c, data: { ...c.data, ...dataPatch } } : c
    );
    saveDayContent(activeDayId, newContent);
  };

  const removeContentBlock = (itemId) => {
    const activeBlock = blocks.find(b => b.id === activeDayId);
    if (!activeBlock) return;

    const newContent = activeBlock.content.filter(c => c.id !== itemId);
    saveDayContent(activeDayId, newContent);
  };

  const addDay = async (type) => {
    const nextNum = type === 'day' ? blocks.filter(b => b.block_type === 'day').length + 1 : null;
    try {
      const b = await itineraryBlocksService.create({
        itinerary_id: id,
        block_type: type,
        day_number: nextNum,
        title: type === 'day' ? `Day ${nextNum}` : type === 'arrival' ? 'Arrival' : 'Departure',
        content: [],
        position: blocks.length
      });
      setBlocks([...blocks, b]);
      setActiveDayId(b.id);
    } catch(e) {
      toast.error('Failed to add day');
    }
  };

  if (loading) return <div className="p-xl text-center">Loading editor...</div>;
  if (!itinerary) return <div className="p-xl text-center">Itinerary not found</div>;

  const activeBlockData = blocks.find(b => b.id === activeDayId);

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 bg-white">
      {/* Sidebar: Day Thread */}
      <div className="w-64 border-r border-outline-variant bg-surface-container-lowest flex flex-col h-full flex-shrink-0">
        <div className="p-md border-b border-outline-variant flex items-center justify-between">
          <button onClick={() => navigate('/itinerary')} className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || !hasUnsavedChanges}
            className={`text-xs font-bold px-3 py-1.5 rounded transition-all ${
              hasUnsavedChanges 
                ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-sm' 
                : 'bg-surface-variant text-on-surface-variant/50 cursor-default'
            }`}
          >
            {saving ? 'SAVING...' : hasUnsavedChanges ? 'SAVE CHANGES' : 'SAVED'}
          </button>
        </div>
        
        <div className="p-md pb-2 font-bold text-on-surface flex justify-between items-center">
          <span>Day Thread</span>
          <div className="flex gap-1">
            <button onClick={() => addDay('arrival')} title="Add Arrival" className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">flight_land</span></button>
            <button onClick={() => addDay('day')} title="Add Day" className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">wb_sunny</span></button>
            <button onClick={() => addDay('departure')} title="Add Departure" className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">flight_takeoff</span></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-md custom-scrollbar space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDays}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map(b => (
                <SortableDayItem 
                  key={b.id} 
                  id={b.id} 
                  block={b} 
                  isActive={viewMode === 'days' && activeDayId === b.id} 
                  onClick={() => { setActiveDayId(b.id); setViewMode('days'); }} 
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="mt-2 space-y-1">
            <button 
              onClick={() => addDay('day')}
              className="w-full flex items-center gap-2 p-sm rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors border border-dashed border-outline-variant/60"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Day</span>
            </button>
          </div>
          
          <div className="pt-4 border-t border-outline-variant/50">
            <div 
              onClick={() => setViewMode('checklists')}
              className={`flex items-center gap-2 p-sm rounded-lg cursor-pointer transition-colors ${
                viewMode === 'checklists' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-container text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">checklist</span>
              <span className="text-sm">Included & Excluded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Editor */}
      <div className="flex-1 overflow-y-auto flex justify-center custom-scrollbar">
        <div className="w-full max-w-3xl p-xl pb-48">
          {viewMode === 'checklists' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-4xl font-bold text-on-surface mb-xl">Included & Excluded</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                <Checklist 
                  title="What's Included" 
                  items={itinerary.included_items || []} 
                  onChange={(newItems) => {
                    const updated = { ...itinerary, included_items: newItems };
                    setItinerary(updated);
                    setHasUnsavedChanges(true);
                  }} 
                />
                <Checklist 
                  title="What's Excluded" 
                  items={itinerary.excluded_items || []} 
                  onChange={(newItems) => {
                    const updated = { ...itinerary, excluded_items: newItems };
                    setItinerary(updated);
                    setHasUnsavedChanges(true);
                  }} 
                  icon="close"
                  iconColor="text-error"
                />
              </div>
            </div>
          ) : activeBlockData ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Day Header */}
              <input 
                type="text" 
                value={activeBlockData.title || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setBlocks(prev => prev.map(b => b.id === activeDayId ? { ...b, title: val } : b));
                  setHasUnsavedChanges(true);
                }}
                className="w-full text-4xl font-bold text-on-surface bg-transparent border-none outline-none focus:ring-0 p-0 mb-xl placeholder:text-on-surface-variant/30"
                placeholder="Day Title..."
              />

              {/* Blocks */}
              <div className="space-y-1 mb-8 min-h-[50px]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndContent}>
                  <SortableContext items={(activeBlockData.content || []).map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {(activeBlockData.content || []).map(item => (
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
              </div>

              {/* Add Block Trigger */}
              <div className="relative">
                <button 
                  onClick={() => setShowBlockMenu(!showBlockMenu)}
                  className="flex items-center gap-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                >
                  <span className="material-symbols-outlined">add</span> Add Block
                </button>

                {showBlockMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-outline-variant rounded-xl shadow-xl z-[200] max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest border-b border-outline-variant/50">Basic Blocks</div>
                    <div className="p-1">
                      <BlockMenuItem icon="title" label="Heading" onClick={() => addContentBlock('heading')} />
                      <BlockMenuItem icon="notes" label="Text" onClick={() => addContentBlock('text')} />
                      <BlockMenuItem icon="image" label="Image" onClick={() => addContentBlock('image')} />
                      <BlockMenuItem icon="photo_library" label="Gallery" onClick={() => addContentBlock('gallery')} />
                    </div>
                    <div className="p-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-lowest border-b border-t border-outline-variant/50">Travel Elements</div>
                    <div className="p-1">
                      <BlockMenuItem icon="hotel" label="Hotel" onClick={() => { setPickerType('hotel'); setShowBlockMenu(false); }} />
                      <BlockMenuItem icon="local_activity" label="Activity" onClick={() => { setPickerType('activity'); setShowBlockMenu(false); }} />
                      <BlockMenuItem icon="flight" label="Flight" onClick={() => { setPickerType('flight'); setShowBlockMenu(false); }} />
                      <BlockMenuItem icon="directions_car" label="Transfer" onClick={() => addContentBlock('transfer')} />
                      <BlockMenuItem icon="restaurant" label="Meals" onClick={() => addContentBlock('meals')} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] opacity-20 mb-4">edit_document</span>
              <p>Select a day or checklist from the sidebar to edit.</p>
            </div>
          )}
        </div>
      </div>
      
      {pickerType && (
        <ResourcePickerModal 
          type={pickerType} 
          onSelect={(data) => {
            addContentBlock(pickerType, data);
            setPickerType(null);
          }} 
          onClose={() => setPickerType(null)} 
        />
      )}
    </div>
  );
}

function Checklist({ title, items, onChange, icon = "check", iconColor = "text-primary" }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = (e) => {
    if (e.key === 'Enter' && newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm">
      <h3 className="font-bold text-lg mb-4 text-on-surface">{title}</h3>
      <div className="space-y-2 mb-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
              <span className="text-on-surface">{item}</span>
            </div>
            <button 
              onClick={() => handleRemove(index)}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded text-on-surface-variant hover:text-error hover:bg-error/10 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="text-on-surface-variant/50 italic text-sm">No items added.</div>}
      </div>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={newItem} 
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleAdd}
          placeholder="Add item and press Enter..."
          className="flex-1 text-sm px-3 py-2 border border-outline-variant rounded bg-surface-container-low text-on-surface focus:border-primary outline-none transition-colors"
        />
      </div>
    </div>
  );
}

function BlockMenuItem({ icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low text-on-surface transition-colors text-left"
    >
      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
    </button>
  );
}
