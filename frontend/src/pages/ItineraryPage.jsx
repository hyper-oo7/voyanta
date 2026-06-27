import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
import ImportModal from '../components/ImportModal.jsx';
import LogoUploader from '../components/LogoUploader.jsx';

export default function ItineraryPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();

  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', destination: '', description: '', duration: 3, cover_image: ''
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await itinerariesService.list();
      setItineraries(list);
      return list;
    } catch (e) {
      toast.error(e.message || 'Failed to load itineraries');
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const checkState = async () => {
      const list = await reload();
      if (location.state?.editItineraryId) {
        const target = list.find(it => it.id === location.state.editItineraryId);
        if (target) setEditingItinerary(target);
        // clear the state so it doesn't reopen on refresh
        navigate('/itinerary', { replace: true, state: {} });
      }
    };
    checkState();
  }, [reload, location.state, navigate]);

  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;

    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Itinerary')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });

    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Itinerary Library';
    const p = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Manage comprehensive travel itineraries and schedules.';

    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.style.display = 'inline-flex';
      cta.innerHTML = '<span class="material-symbols-outlined text-[20px]">add</span> Create New';
      cta.onclick = () => setCreateOpen(true);
    }

    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#itinerary-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'itinerary-mount';
      canvas.appendChild(mount);
    }
    setMountNode(mount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const card = document.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    card.style.cursor = 'pointer';
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Itinerary Name is required'); return; }
    setSaving(true);
    try {
      const it = await itinerariesService.create({
        name: formData.name.trim(),
        destination: formData.destination.trim(),
        duration: formData.duration,
        description: formData.description,
        cover_image: formData.cover_image,
      });
      
      // Auto-create basic blocks
      const blocks = [];
      blocks.push({ itinerary_id: it.id, block_type: 'arrival', title: 'Arrival & Check-in', position: 0 });
      for (let i = 1; i <= formData.duration; i++) {
        blocks.push({ itinerary_id: it.id, block_type: 'day', day_number: i, title: `Day ${i} Itinerary`, position: i });
      }
      blocks.push({ itinerary_id: it.id, block_type: 'departure', title: 'Departure', position: formData.duration + 1 });
      
      await Promise.all(blocks.map((b) => itineraryBlocksService.create(b)));
      
      toast.success('Itinerary created');
      setCreateOpen(false);
      setFormData({ name: '', destination: '', description: '', duration: 3, cover_image: '' });
      reload();
    } catch (err) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this itinerary?')) return;
    try {
      await itinerariesService.remove(id);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="space-y-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {loading ? (
              <div className="col-span-3 text-center py-xl text-on-surface-variant">Loading itineraries…</div>
            ) : itineraries.length === 0 ? (
              <div className="col-span-3 text-center py-xl text-on-surface-variant">No itineraries found. Create one!</div>
            ) : itineraries.map((it) => (
              <div key={it.id} className="glass-card rounded-xl overflow-hidden flex flex-col group hover:border-primary transition-all shadow-sm cursor-pointer" onClick={() => navigate(`/itinerary/${it.id}`)}>
                <div className="h-40 bg-slate-100 relative">
                  {it.cover_image ? (
                    <img src={it.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant bg-surface-variant">
                      <span className="material-symbols-outlined text-[32px]">map</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }} title="Delete" className="w-8 h-8 rounded-full bg-white/90 text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="p-lg flex flex-col flex-1">
                  <h4 className="font-headline-sm text-primary font-bold line-clamp-1" title={it.name}>{it.name}</h4>
                  <p className="text-xs text-on-surface-variant mb-md font-semibold">{it.destination || 'Multiple Destinations'} · {it.duration} Days</p>
                  <p className="text-sm text-on-surface line-clamp-2 mb-lg flex-1">{it.description || 'No description provided.'}</p>
                  <button onClick={(e) => { e.stopPropagation(); setEditingItinerary(it); }} className="w-full py-sm bg-surface-container-low border border-outline-variant rounded-lg font-label-md text-primary font-bold hover:bg-primary/10 transition-colors">
                    Edit Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>

          {importOpen && <ImportModal resource="itineraries" onClose={() => setImportOpen(false)} onImported={reload} />}

          {createOpen && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
              <div className="bg-white w-full max-w-lg rounded-xl p-xl border border-outline-variant space-y-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-md">
                  <h3 className="font-headline-sm text-primary font-bold">New Itinerary</h3>
                  <button onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-md">
                  <LogoUploader value={formData.cover_image} onChange={(v) => setFormData(s => ({ ...s, cover_image: v }))} label="Cover Image" testid="itin-cover" folder="covers" />
                  
                  <div className="grid grid-cols-2 gap-md">
                    <label className="flex flex-col gap-xs col-span-2">
                      <span className="font-label-md text-on-surface font-semibold">Itinerary Name *</span>
                      <input type="text" required value={formData.name} onChange={(e) => setFormData(s => ({ ...s, name: e.target.value }))}
                        className="px-md py-md border border-outline-variant rounded-lg font-body-md bg-surface-container-lowest" placeholder="e.g. Italian Lakes Luxury Getaway" />
                    </label>
                    <label className="flex flex-col gap-xs">
                      <span className="font-label-md text-on-surface font-semibold">Destination</span>
                      <input type="text" value={formData.destination} onChange={(e) => setFormData(s => ({ ...s, destination: e.target.value }))}
                        className="px-md py-md border border-outline-variant rounded-lg font-body-md bg-surface-container-lowest" placeholder="e.g. Como & Garda, Italy" />
                    </label>
                    <label className="flex flex-col gap-xs">
                      <span className="font-label-md text-on-surface font-semibold">Duration (Days)</span>
                      <input type="number" min="1" max="90" value={formData.duration} onChange={(e) => setFormData(s => ({ ...s, duration: parseInt(e.target.value) || 1 }))}
                        className="px-md py-md border border-outline-variant rounded-lg font-body-md bg-surface-container-lowest" />
                    </label>
                  </div>
                  <label className="flex flex-col gap-xs">
                    <span className="font-label-md text-on-surface font-semibold">Description</span>
                    <textarea value={formData.description} onChange={(e) => setFormData(s => ({ ...s, description: e.target.value }))} rows={3}
                      className="px-md py-md border border-outline-variant rounded-lg font-body-md bg-surface-container-lowest" placeholder="Brief overview of the experience..." />
                  </label>
                  <div className="flex gap-md pt-md">
                    <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-colors shadow-sm">
                      {saving ? 'Creating…' : 'Create Itinerary'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingItinerary && (
            <ItineraryScheduleDrawer
              itinerary={editingItinerary}
              onClose={() => setEditingItinerary(null)}
            />
          )}
        </div>,
        mountNode
      )}
    </div>
  );
}

function ItineraryScheduleDrawer({ itinerary, onClose }) {
  const toast = useToast();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [draggedIdx, setDraggedIdx] = useState(null);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const list = await itineraryBlocksService.list({ itinerary_id: itinerary.id });
        setBlocks(list.sort((a, b) => (a.position || 0) - (b.position || 0)));
      } catch (e) {
        toast.error('Failed to load blocks');
      } finally {
        setLoading(false);
      }
    };
    fetchBlocks();
  }, [itinerary.id, toast]);

  const updateBlock = (index, key, val) => {
    setBlocks((prev) => prev.map((b, i) => i === index ? { ...b, [key]: val } : b));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await Promise.all(blocks.map((b, i) => {
        const patch = { ...b, position: i };
        return b.id
          ? itineraryBlocksService.update(b.id, patch)
          : itineraryBlocksService.create({ ...patch, itinerary_id: itinerary.id });
      }));
      toast.success('Schedule saved successfully');
      onClose();
    } catch (err) {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to generate before adding opacity
    setTimeout(() => { if (e.target) e.target.classList.add('opacity-50'); }, 0);
  };

  const handleDragEnd = (e) => {
    setDraggedIdx(null);
    if (e.target) e.target.classList.remove('opacity-50');
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newBlocks = [...blocks];
    const item = newBlocks.splice(draggedIdx, 1)[0];
    newBlocks.splice(targetIdx, 0, item);
    
    // Automatically renumber days based on new order
    let dayCounter = 1;
    newBlocks.forEach(b => {
      if (b.block_type === 'day') {
        b.day_number = dayCounter++;
        // If title is just "Day X", update it. Otherwise keep custom titles.
        if (b.title && b.title.match(/^Day \d+$/)) {
          b.title = `Day ${b.day_number}`;
        }
      }
    });
    
    setBlocks(newBlocks);
  };

  const addBlock = (type) => {
    const nextNum = type === 'day' ? blocks.filter(b => b.block_type === 'day').length + 1 : null;
    setBlocks([...blocks, {
      block_type: type,
      day_number: nextNum,
      title: type === 'day' ? `Day ${nextNum}` : type === 'arrival' ? 'Arrival' : 'Departure',
      description: '', morning_notes: '', afternoon_notes: '', evening_notes: '', night_notes: '', notes: ''
    }]);
  };

  return (
    <div className="fixed inset-0 z-[80] flex text-on-surface">
      <div className="flex-1 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[720px] bg-white h-full flex flex-col shadow-2xl border-l border-outline-variant">
        <div className="p-xl border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center z-10">
          <div>
            <h3 className="font-headline-sm text-primary font-bold">Edit Schedule</h3>
            <p className="text-sm font-semibold text-on-surface-variant mt-1">{itinerary.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-xl bg-slate-50 space-y-lg custom-scrollbar">
          {loading ? (
            <div className="text-center py-xl text-on-surface-variant">Loading schedule blocks…</div>
          ) : (
            blocks.map((b, i) => (
              <div key={b.id || i}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, i)}
                className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col group cursor-grab active:cursor-grabbing"
              >
                <div className="bg-surface-container-low px-md py-sm border-b border-outline-variant flex items-center gap-sm">
                  <span className="material-symbols-outlined text-on-surface-variant cursor-grab">drag_indicator</span>
                  <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-widest ${
                    b.block_type === 'arrival' ? 'bg-emerald-100 text-emerald-800' :
                    b.block_type === 'departure' ? 'bg-rose-100 text-rose-800' :
                    'bg-primary-fixed/30 text-primary-fixed-dim'
                  }`}>
                    {b.block_type} {b.day_number ? b.day_number : ''}
                  </span>
                  <input type="text" value={b.title || ''} onChange={(e) => updateBlock(i, 'title', e.target.value)}
                    className="flex-1 bg-transparent font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 py-0.5" placeholder="Block Title..." />
                  <button type="button" onClick={() => setBlocks(blocks.filter((_, idx) => idx !== i))}
                    className="w-8 h-8 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                
                <div className="p-md space-y-md">
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">Description</span>
                    <textarea value={b.description || ''} onChange={(e) => updateBlock(i, 'description', e.target.value)} rows={2}
                      className="w-full px-md py-sm border border-outline-variant rounded bg-surface-container-lowest text-sm focus:border-primary outline-none" placeholder="Rich description..." />
                  </label>
                  
                  {b.block_type === 'day' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      <label className="block">
                        <span className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">light_mode</span> Morning</span>
                        <textarea value={b.morning_notes || ''} onChange={(e) => updateBlock(i, 'morning_notes', e.target.value)} rows={2}
                          className="w-full px-sm py-sm border border-outline-variant rounded bg-sky-50/50 text-xs focus:border-primary outline-none" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">wb_sunny</span> Afternoon</span>
                        <textarea value={b.afternoon_notes || ''} onChange={(e) => updateBlock(i, 'afternoon_notes', e.target.value)} rows={2}
                          className="w-full px-sm py-sm border border-outline-variant rounded bg-amber-50/50 text-xs focus:border-primary outline-none" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">nights_stay</span> Evening</span>
                        <textarea value={b.evening_notes || ''} onChange={(e) => updateBlock(i, 'evening_notes', e.target.value)} rows={2}
                          className="w-full px-sm py-sm border border-outline-variant rounded bg-indigo-50/50 text-xs focus:border-primary outline-none" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">bedtime</span> Night</span>
                        <textarea value={b.night_notes || ''} onChange={(e) => updateBlock(i, 'night_notes', e.target.value)} rows={2}
                          className="w-full px-sm py-sm border border-outline-variant rounded bg-slate-100 text-xs focus:border-primary outline-none" />
                      </label>
                    </div>
                  )}
                  
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">Internal Notes / Accommodations</span>
                    <input type="text" value={b.notes || ''} onChange={(e) => updateBlock(i, 'notes', e.target.value)}
                      className="w-full px-md py-sm border border-outline-variant rounded bg-surface-container-lowest text-sm focus:border-primary outline-none" placeholder="e.g. Flight arrives 10:00 AM, VIP transfer..." />
                  </label>
                  
                  <div className="pt-sm">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">Day Image</span>
                    <LogoUploader value={b.image_url || ''} onChange={(v) => updateBlock(i, 'image_url', v)} label="Upload Image" folder="itineraries" testid={`day-img-${i}`} />
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-sm justify-center pt-md pb-xl">
            <button type="button" onClick={() => addBlock('arrival')} className="px-md py-sm border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg text-sm font-bold flex items-center gap-xs hover:bg-emerald-100 transition-colors"><span className="material-symbols-outlined text-[18px]">add</span> Arrival</button>
            <button type="button" onClick={() => addBlock('day')} className="px-md py-sm border border-primary/30 bg-primary-fixed/20 text-primary-fixed-dim rounded-lg text-sm font-bold flex items-center gap-xs hover:bg-primary-fixed/40 transition-colors"><span className="material-symbols-outlined text-[18px]">add</span> Day Block</button>
            <button type="button" onClick={() => addBlock('departure')} className="px-md py-sm border border-rose-200 bg-rose-50 text-rose-800 rounded-lg text-sm font-bold flex items-center gap-xs hover:bg-rose-100 transition-colors"><span className="material-symbols-outlined text-[18px]">add</span> Departure</button>
          </div>
        </div>

        <div className="p-xl border-t border-outline-variant bg-white flex gap-md z-10">
          <button onClick={onClose} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-60 transition-colors shadow-md">
            {saving ? 'Saving Schedule…' : 'Save Schedule'}
          </button>
        </div>
      </aside>
    </div>
  );
}
