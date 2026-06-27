import { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useProposalBuilder } from '../context/ProposalBuilderContext.jsx';
import EditItemDrawer from './EditItemDrawer.jsx';
import ImportModal from './ImportModal.jsx';
import { addItem } from '../services/proposalItemService.js';

export default function ResourceModulePage({
  resource, service, title, subtitle, sidebarLabel,
  itemKind = 'custom', toLabel = (r) => r.name || r.airline || 'Item', toUnitPrice = (r) => Number(r.price ?? r.price_per_night ?? r.cost ?? 0),
  filterRows, renderToolbar
}) {
  const toast = useToast();
  const { activeId } = useProposalBuilder() || {};
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [adding, setAdding] = useState(false);

  // Search & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState(resource === 'flights' ? 'list' : 'grid');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.list());
    } catch (e) {
      toast.error(e.message || 'Failed to load supplier items');
    } finally {
      setLoading(false);
    }
  }, [service, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onAddToProposal = async () => {
    if (!activeId) {
      toast.error('Open a proposal first (Dashboard → Create New Proposal)');
      return;
    }
    if (!selection.size) return;
    setAdding(true);
    try {
      const picked = rows.filter((r) => selection.has(r.id));
      for (const r of picked) {
        await addItem(activeId, {
          kind: itemKind,
          ref_id: r.id,
          label: toLabel(r),
          qty: 1,
          unit_price: toUnitPrice(r),
          currency: r.currency || 'INR',
          meta: { source: resource },
        });
      }
      toast.success(`Added ${picked.length} ${resource} to proposal`);
      setSelection(new Set());
    } catch (e) {
      toast.error(e.message || 'Failed to add items');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(`Are you sure you want to delete this ${resource.slice(0, -1)}?`)) return;
    try {
      await service.remove(id);
      toast.success('Item deleted successfully');
      reload();
    } catch (e) {
      toast.error(e.message || 'Failed to delete item');
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelection(next);
  };

  // Filtered & Sorted Rows
  const processedRows = useMemo(() => {
    let result = filterRows ? filterRows(rows) : rows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.name || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.airline || '').toLowerCase().includes(q) ||
        (r.origin || '').toLowerCase().includes(q) ||
        (r.destination || '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'price-asc') {
        return toUnitPrice(a) - toUnitPrice(b);
      }
      if (sortBy === 'price-desc') {
        return toUnitPrice(b) - toUnitPrice(a);
      }
      if (sortBy === 'rating-desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      // default: name asc
      const nameA = (a.name || a.airline || '').toLowerCase();
      const nameB = (b.name || b.airline || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [rows, searchQuery, sortBy, filterRows, toUnitPrice]);

  return (
    <div className="space-y-lg pb-xxl max-w-[1200px] mx-auto">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant pb-lg">
        <div>
          <h2 className="font-headline-lg text-[32px] font-bold text-on-surface m-0 tracking-tight">{title}</h2>
          <p className="font-body-lg text-on-surface-variant m-0 mt-xs">{subtitle}</p>
        </div>
        <div className="flex items-center gap-md">
          <button 
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-sm px-xl py-md bg-on-surface text-surface rounded-lg font-label-md hover:opacity-90 active:scale-[0.98] transition-all border-none"
          >
            <span className="material-symbols-outlined text-[20px]">upload</span>
            Import supplier file
          </button>
        </div>
      </div>

      {/* Custom renderToolbar */}
      {renderToolbar?.()}

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-md items-center justify-between bg-surface-container-lowest p-md border border-outline-variant rounded-xl">
        <div className="relative w-full sm:max-w-xs">
          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input 
            type="text" 
            placeholder={`Search ${resource}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low pl-xl pr-md py-sm rounded-full font-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 border-none"
          />
        </div>

        <div className="flex items-center gap-md w-full sm:w-auto justify-end">
          <div className="flex items-center gap-sm">
            <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Sort by</span>
            <select 
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-surface border border-outline rounded-lg px-md py-sm font-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="name-asc">Alphabetical (A-Z)</option>
              <option value="price-asc">Price (Lowest)</option>
              <option value="price-desc">Price (Highest)</option>
              {resource === 'hotels' && <option value="rating-desc">Rating (Highest)</option>}
            </select>
          </div>
          
          <div className="flex items-center border border-outline rounded-lg overflow-hidden">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-sm flex items-center justify-center border-none transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-surface-container-high text-primary' : 'bg-transparent text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-sm flex items-center justify-center border-none transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-surface-container-high text-primary' : 'bg-transparent text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[20px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid / List container */}
      {loading ? (
        <div className="py-xxl text-center text-on-surface-variant font-body-lg">
          <span className="material-symbols-outlined animate-spin text-xxl mb-md">progress_activity</span>
          <div>Loading database...</div>
        </div>
      ) : processedRows.length === 0 ? (
        <div className="py-xxl text-center border border-dashed border-outline-variant rounded-2xl bg-surface-container-lowest">
          <span className="material-symbols-outlined text-xxl text-on-surface-variant mb-md">database</span>
          <p className="font-body-lg text-on-surface-variant m-0 mb-md">No records found matching your criteria.</p>
          <button 
            onClick={() => setImportOpen(true)}
            className="px-lg py-sm bg-on-surface text-surface font-label-sm rounded-lg hover:opacity-90 transition-opacity border-none"
          >
            Import data
          </button>
        </div>
      ) : viewMode === 'grid' && resource !== 'flights' ? (
        // Grid View (Hotels, Activities)
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
          {processedRows.map(item => (
            <div 
              key={item.id} 
              className={`bg-surface border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between h-[420px] ${selection.has(item.id) ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
            >
              {/* Hotel / Activity Cover Image */}
              <div className="h-48 relative bg-surface-container-high flex-shrink-0">
                <img 
                  src={item.image_url || item.cover_image || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'} 
                  alt={item.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-md right-md flex items-center gap-sm">
                  {/* Select Checkbox Overlaid */}
                  <button 
                    onClick={() => toggleSelect(item.id)}
                    className={`w-8 h-8 rounded-full border-none flex items-center justify-center cursor-pointer shadow-md transition-colors ${selection.has(item.id) ? 'bg-primary text-on-primary' : 'bg-white/80 hover:bg-white text-on-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {selection.has(item.id) ? 'check' : 'add'}
                    </span>
                  </button>
                </div>

                {resource === 'hotels' && item.rating && (
                  <div className="absolute bottom-md left-md bg-black/60 backdrop-blur-sm text-white px-md py-sm rounded-full text-xs font-bold flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[14px] text-amber-400">star</span>
                    {Number(item.rating).toFixed(1)}
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-lg flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-lg text-on-surface mb-xs m-0 leading-tight truncate">{item.name}</h3>
                  <div className="flex items-center gap-xs text-on-surface-variant font-body-md text-xs mb-sm">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    <span className="truncate">{item.location}{item.country ? `, ${item.country}` : ''}</span>
                  </div>

                  {/* Amenities pills */}
                  {resource === 'hotels' && item.amenities && (
                    <div className="flex flex-wrap gap-xs mb-md max-h-[64px] overflow-hidden">
                      {item.amenities.slice(0, 3).map((am, idx) => (
                        <span key={idx} className="bg-surface-container px-md py-sm text-[10px] rounded font-label-sm uppercase tracking-wider text-on-surface-variant">
                          {am}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Activity Type & Hours */}
                  {resource === 'activities' && (
                    <div className="flex gap-md font-body-md text-xs text-on-surface-variant mb-md">
                      {item.type && <span className="bg-surface-container px-md py-sm rounded uppercase tracking-wider font-label-sm">{item.type}</span>}
                      {item.duration_hours && <span>Duration: {item.duration_hours} hrs</span>}
                    </div>
                  )}
                </div>

                {/* Bottom line price + actions */}
                <div className="flex justify-between items-center border-t border-outline-variant pt-md">
                  <div>
                    <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider block">Price</span>
                    <span className="font-display text-lg text-on-surface">
                      {item.currency || 'INR'} {toUnitPrice(item).toLocaleString()}
                      {resource === 'hotels' ? '/night' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <button 
                      onClick={() => setEditing(item)}
                      className="w-8 h-8 rounded-full border border-outline-variant hover:bg-surface-container-low flex items-center justify-center text-on-surface bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 rounded-full border border-outline-variant hover:bg-error-container/20 flex items-center justify-center text-error bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View / Flights View (Image 8 style)
        <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm divide-y divide-outline-variant">
          {processedRows.map(item => (
            <div 
              key={item.id} 
              className={`p-lg hover:bg-surface-container-lowest transition-colors flex items-center gap-xl justify-between ${selection.has(item.id) ? 'bg-primary-fixed/20' : ''}`}
            >
              {/* Left Column: Selector + Details */}
              <div className="flex items-center gap-lg min-w-0 flex-1">
                <input 
                  type="checkbox" 
                  checked={selection.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="w-5 h-5 rounded cursor-pointer"
                />

                {resource === 'flights' ? (
                  /* Flight Specific Details Layout */
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-md md:gap-xl w-full min-w-0">
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined">flight</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display text-sm font-semibold m-0 text-on-surface">{item.airline}</h4>
                        <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider m-0">{item.flight_no}</p>
                      </div>
                    </div>

                    <div>
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider block">ROUTE</span>
                      <span className="font-body-md text-sm font-semibold text-on-surface">{item.origin} → {item.destination}</span>
                    </div>

                    <div>
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider block">DEPARTURE</span>
                      <span className="font-body-md text-sm font-semibold text-on-surface">
                        {item.depart_date ? new Date(item.depart_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider block">CLASS & DURATION</span>
                      <span className="font-body-md text-sm font-semibold text-on-surface uppercase">{item.class || 'Economy'} • {item.duration || '—'}</span>
                    </div>
                  </div>
                ) : (
                  /* Default list layout for Hotels/Activities */
                  <div className="flex items-center gap-md min-w-0">
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-display text-sm font-semibold m-0 text-on-surface">{item.name}</h4>
                      <p className="font-body-md text-xs text-on-surface-variant m-0">{item.location}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Price + Operations */}
              <div className="flex items-center gap-xl flex-shrink-0">
                <div className="text-right">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider block">PRICE</span>
                  <span className="font-display text-md font-bold text-on-surface">
                    {item.currency || 'INR'} {toUnitPrice(item).toLocaleString()}
                    {resource === 'hotels' ? '/nt' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-xs">
                  <button 
                    onClick={() => setEditing(item)}
                    className="w-8 h-8 rounded-full border border-outline-variant hover:bg-surface-container-low flex items-center justify-center text-on-surface bg-transparent cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="w-8 h-8 rounded-full border border-outline-variant hover:bg-error-container/20 flex items-center justify-center text-error bg-transparent cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Bulk Selection Action Bar */}
      {activeId && selection.size > 0 && (
        <div className="fixed bottom-lg left-1/2 -translate-x-1/2 bg-on-surface text-surface shadow-2xl rounded-2xl px-xl py-md flex items-center gap-xl z-50 border border-white/10 animate-float">
          <div className="flex items-center gap-sm">
            <span className="w-6 h-6 bg-white/10 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {selection.size}
            </span>
            <span className="font-label-sm text-sm tracking-wider uppercase">Items selected</span>
          </div>
          <div className="flex gap-md">
            <button 
              onClick={() => setSelection(new Set())}
              className="px-md py-sm bg-white/10 hover:bg-white/20 text-white font-label-sm rounded-lg border-none cursor-pointer"
            >
              Clear
            </button>
            <button 
              onClick={onAddToProposal} 
              disabled={adding}
              className="px-lg py-sm bg-white text-black font-label-sm font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 border-none cursor-pointer"
            >
              {adding ? 'Adding...' : 'Add to Active Proposal'}
            </button>
          </div>
        </div>
      )}

      {/* Overlays */}
      {importOpen && (
        <ImportModal 
          resource={resource}
          onClose={() => setImportOpen(false)}
          onImported={(count) => { 
            setImportOpen(false); 
            toast.success(`Imported ${count} records successfully`); 
            reload(); 
          }}
        />
      )}
      {editing && (
        <EditItemDrawer 
          item={editing} 
          resource={resource} 
          service={service}
          onClose={() => setEditing(null)}
          onSaved={() => { 
            setEditing(null); 
            reload(); 
            toast.success('Saved details'); 
          }}
        />
      )}
    </div>
  );
}
