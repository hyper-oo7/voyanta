import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService } from '../services/resourceService.js';
import ImportModal from '../components/ImportModal.jsx';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from './_html/voyanta_dashboard.js';

export default function ItineraryPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();

  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDest, setNewDest] = useState('');
  const [newDays, setNewDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await itinerariesService.list();
      setItineraries(list);
    } catch (e) {
      toast.error(e.message || 'Failed to load itineraries');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { reload(); }, [reload]);

  // Adjust sidebar navigation and titles
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const canvas = root.querySelector('main .max-w-7xl'); if (!canvas) return;

    // Sidebar active highlight
    root.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Itinerary')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });

    // Page titles
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Itinerary Library';
    const p = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Manage independent travel itineraries and import PDF travel concierges.';

    // Primary CTA -> Create New
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) {
      cta.innerHTML = '<span class="material-symbols-outlined text-[20px]">add</span> Create New';
      cta.onclick = () => setCreateOpen(true);
    }

    // Clear old dashboard grid & inject itinerary-mount
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#itinerary-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'itinerary-mount';
      canvas.appendChild(mount);
    }
  });

  // User card navigation and sign-out
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const card = root.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
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
    if (!newName.trim()) { toast.error('Itinerary Name is required'); return; }
    setSaving(true);
    try {
      const daysArr = [];
      for (let i = 1; i <= newDays; i++) {
        daysArr.push({
          day: i,
          title: `Day ${i} Theme`,
          description: 'Add activities, hotels, and schedule details for this day.',
          hotels: [],
          activities: [],
          transfers: [],
          meals: [],
          notes: ''
        });
      }
      await itinerariesService.create({
        name: newName.trim(),
        destination: newDest.trim(),
        days: newDays,
        data: { days: daysArr }
      });
      toast.success('Itinerary created');
      setNewName('');
      setNewDest('');
      setNewDays(3);
      setCreateOpen(false);
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

  const handleSaveDays = async (updatedDays) => {
    if (!editingItinerary) return;
    setSaving(true);
    try {
      await itinerariesService.update(editingItinerary.id, {
        days: updatedDays.length,
        data: { ...editingItinerary.data, days: updatedDays }
      });
      toast.success('Itinerary saved');
      setEditingItinerary(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const mount = wrapperRef.current?.querySelector('#itinerary-mount');

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage styleId="stitch-style-itinerary-page" bodyClass={VoyantaDashboard_bodyClass}
        extraStyles={VoyantaDashboard_extraStyles} html={VoyantaDashboard_html} navMap={navMap} />
      {mount && createPortal(
        <div className="space-y-lg">
          <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap">
            <h3 className="font-headline-sm text-headline-sm text-primary flex-1">Standalone Itineraries</h3>
            <button onClick={() => setImportOpen(true)} data-testid="import-pdf-itinerary-btn"
              className="px-lg py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">upload</span> Import PDF
            </button>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-on-surface font-label-sm uppercase tracking-wider">
                <tr>
                  <th className="px-lg py-md">Name</th>
                  <th className="px-lg py-md">Destination</th>
                  <th className="px-lg py-md">Days</th>
                  <th className="px-lg py-md text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body-md text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-xl text-on-surface-variant">Loading itineraries…</td>
                  </tr>
                ) : itineraries.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-xl text-on-surface-variant">No itineraries found. Create or import one!</td>
                  </tr>
                ) : itineraries.map((it) => (
                  <tr key={it.id} className="hover:bg-surface-container-low transition-colors" data-testid={`itinerary-row-${it.id}`}>
                    <td className="px-lg py-md font-bold text-primary">{it.name}</td>
                    <td className="px-lg py-md">{it.destination || '—'}</td>
                    <td className="px-lg py-md font-mono">{it.days || it.data?.days?.length || 0}</td>
                    <td className="px-lg py-md text-right flex justify-end gap-sm">
                      <button onClick={() => setEditingItinerary(it)} title="Edit Day-by-Day"
                        className="px-md py-1 border border-outline rounded hover:bg-surface-container-high text-xs font-semibold">
                        Edit Schedule
                      </button>
                      <button onClick={() => handleDelete(it.id)} title="Delete"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container text-error">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Modal */}
          {importOpen && <ImportModal resource="itineraries" onClose={() => setImportOpen(false)} onImported={reload} />}

          {/* Create Modal */}
          {createOpen && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-xl p-lg border border-outline-variant space-y-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                  <h3 className="font-headline-sm text-primary font-bold">New Independent Itinerary</h3>
                  <button onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-md">
                  <label className="flex flex-col gap-xs">
                    <span className="font-label-md text-on-surface font-semibold">Itinerary Name *</span>
                    <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)}
                      className="px-md py-md border border-outline-variant rounded-lg font-body-md" placeholder="e.g. Italian Lakes Luxury Getaway" />
                  </label>
                  <label className="flex flex-col gap-xs">
                    <span className="font-label-md text-on-surface font-semibold">Destination</span>
                    <input type="text" value={newDest} onChange={(e) => setNewDest(e.target.value)}
                      className="px-md py-md border border-outline-variant rounded-lg font-body-md" placeholder="e.g. Como & Garda, Italy" />
                  </label>
                  <label className="flex flex-col gap-xs">
                    <span className="font-label-md text-on-surface font-semibold">Duration (Days)</span>
                    <input type="number" min="1" max="30" value={newDays} onChange={(e) => setNewDays(parseInt(e.target.value) || 1)}
                      className="px-md py-md border border-outline-variant rounded-lg font-body-md" />
                  </label>
                  <div className="flex gap-md pt-sm">
                    <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90">
                      {saving ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Schedule Editor Drawer */}
          {editingItinerary && (
            <ItineraryScheduleDrawer
              itinerary={editingItinerary}
              onClose={() => setEditingItinerary(null)}
              onSave={handleSaveDays}
              saving={saving}
            />
          )}
        </div>,
        mount
      )}
    </div>
  );
}

// Sub-component: Standalone Schedule Editor Drawer
function ItineraryScheduleDrawer({ itinerary, onClose, onSave, saving }) {
  const [days, setDays] = useState(itinerary.data?.days || []);

  const updateDay = (index, key, val) => {
    setDays((prev) => prev.map((d, i) => i === index ? { ...d, [key]: val } : d));
  };

  const addDay = () => {
    const nextNum = days.length + 1;
    setDays((prev) => [...prev, {
      day: nextNum,
      title: `Day {nextNum} Schedule`,
      description: 'Add description for activities or meals.',
      hotels: [],
      activities: [],
      transfers: [],
      meals: [],
      notes: ''
    }]);
  };

  const removeDay = (index) => {
    if (days.length <= 1) return;
    setDays((prev) => prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 })));
  };

  return (
    <div className="fixed inset-0 z-[80] flex text-on-surface">
      <div className="flex-1 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[640px] bg-white h-full overflow-y-auto border-l border-outline-variant shadow-2xl p-xl flex flex-col">
        <div className="flex items-center justify-between mb-lg">
          <div>
            <h3 className="font-headline-sm text-primary font-bold">Edit Schedule</h3>
            <p className="text-xs text-on-surface-variant">{itinerary.name}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-sm space-y-md custom-scrollbar">
          {days.map((d, i) => (
            <div key={i} className="p-md border border-outline-variant rounded-xl bg-slate-50 space-y-sm relative">
              <button type="button" onClick={() => removeDay(i)} title="Delete Day"
                className="absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-error-container text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
              <div className="flex items-center gap-sm">
                <span className="px-2 py-1 bg-primary text-on-primary rounded font-mono font-bold text-xs">DAY {d.day}</span>
                <input type="text" value={d.title || ''} onChange={(e) => updateDay(i, 'title', e.target.value)}
                  className="flex-1 px-md py-1 border border-outline-variant rounded-lg font-bold text-sm bg-white" placeholder="Day Title (e.g. Arrival & Greeting)" />
              </div>
              <textarea value={d.description || ''} onChange={(e) => updateDay(i, 'description', e.target.value)}
                rows={3} className="w-full px-md py-md border border-outline-variant rounded-lg text-sm bg-white" placeholder="Activities description, timings, details..." />
              
              <div className="grid grid-cols-2 gap-sm text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface-variant">Hotels (comma-sep)</span>
                  <input type="text" value={Array.isArray(d.hotels) ? d.hotels.join(', ') : d.hotels || ''}
                    onChange={(e) => updateDay(i, 'hotels', e.target.value.split(',').map(s => s.trim()))}
                    className="px-md py-1 border border-outline-variant rounded bg-white" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface-variant">Activities (comma-sep)</span>
                  <input type="text" value={Array.isArray(d.activities) ? d.activities.join(', ') : d.activities || ''}
                    onChange={(e) => updateDay(i, 'activities', e.target.value.split(',').map(s => s.trim()))}
                    className="px-md py-1 border border-outline-variant rounded bg-white" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface-variant">Transfers (comma-sep)</span>
                  <input type="text" value={Array.isArray(d.transfers) ? d.transfers.join(', ') : d.transfers || ''}
                    onChange={(e) => updateDay(i, 'transfers', e.target.value.split(',').map(s => s.trim()))}
                    className="px-md py-1 border border-outline-variant rounded bg-white" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface-variant">Meals (e.g. Breakfast, Dinner)</span>
                  <input type="text" value={Array.isArray(d.meals) ? d.meals.join(', ') : d.meals || ''}
                    onChange={(e) => updateDay(i, 'meals', e.target.value.split(',').map(s => s.trim()))}
                    className="px-md py-1 border border-outline-variant rounded bg-white" />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-on-surface-variant">Notes</span>
                <input type="text" value={d.notes || ''} onChange={(e) => updateDay(i, 'notes', e.target.value)}
                  className="px-md py-1 border border-outline-variant rounded bg-white" placeholder="Special requirements, baggage info, attire, etc." />
              </label>
            </div>
          ))}

          <button type="button" onClick={addDay} className="w-full py-md border border-dashed border-primary text-primary hover:bg-sky-50 rounded-xl font-bold flex items-center justify-center gap-xs">
            <span className="material-symbols-outlined">add</span> Add Next Day
          </button>
        </div>

        <div className="flex gap-md pt-lg mt-md border-t border-outline-variant">
          <button onClick={onClose} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(days)} disabled={saving}
            className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </aside>
    </div>
  );
}
