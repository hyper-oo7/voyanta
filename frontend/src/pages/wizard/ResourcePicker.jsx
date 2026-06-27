import { useState, useEffect, useCallback } from 'react';
import DynamicTable from '../../components/DynamicTable.jsx';
import { hotelsService } from '../../services/resourceService.js';

export function SelectedHotelItem({ it, onRemoveItem, onPatchItem }) {
  const [hotelRecord, setHotelRecord] = useState(null);

  useEffect(() => {
    if (it.ref_id) {
      hotelsService.get(it.ref_id).then(setHotelRecord).catch(() => {});
    }
  }, [it.ref_id]);

  const images = hotelRecord?.raw?.images || (hotelRecord?.image_url ? [hotelRecord.image_url] : []);
  const selected = it.meta?.selected_images || [];

  const toggleImage = (url) => {
    let next;
    if (selected.includes(url)) {
      next = selected.filter((u) => u !== url);
    } else {
      next = [...selected, url];
    }
    onPatchItem(it.id, {
      meta: { ...(it.meta || {}), selected_images: next }
    });
  };

  return (
    <li className="flex flex-col px-lg py-md gap-md text-on-surface" data-testid={`selected-${it.id}`}>
      <div className="flex items-center gap-md w-full">
        <span className="font-body-md flex-1 truncate font-bold">{it.label}</span>
        <span className="font-label-sm text-on-surface-variant">{it.unit_price} {it.currency}</span>
        <button onClick={() => onRemoveItem(it.id)} title="Remove"
          className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      {images.length > 0 && (
        <div className="pl-6 space-y-sm">
          <span className="text-xs font-semibold text-on-surface-variant block">Select Photos to Include in Proposal:</span>
          <div className="flex gap-md flex-wrap">
            {images.map((url, index) => {
              const isChecked = selected.includes(url);
              return (
                <label key={index} className="relative cursor-pointer group flex flex-col items-center">
                  <div className={`w-28 h-20 rounded-lg overflow-hidden border-2 bg-slate-100 shadow-sm relative transition-all ${isChecked ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white border border-outline flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleImage(url)}
                        className="rounded-full h-3 w-3 accent-primary border-none cursor-pointer focus:ring-0"
                      />
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}

export function ResourceStep({ kind, service, resource, items, addItems, onRemoveItem, onPatchItem, setImportOpen }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await service.list()); } catch { /* surfaced by caller */ }
    finally { setLoading(false); }
  }, [service]);

  useEffect(() => { reload(); }, [reload]);

  const ofKind = items.filter((it) => it.kind === kind);
  const selectedIds = new Set(ofKind.map((it) => it.ref_id));

  const handleToggleHotel = async (r, checked) => {
    if (checked) {
      await addItems([r]);
    } else {
      const addedItem = ofKind.find((it) => it.ref_id === r.id);
      if (addedItem) onRemoveItem(addedItem.id);
    }
  };

  const handleTableSelection = async (nextSet) => {
    const nextArr = Array.from(nextSet);
    const addedIds = Array.from(selectedIds);
    // Newly checked
    const newlyChecked = nextArr.filter(id => !addedIds.includes(id));
    if (newlyChecked.length > 0) {
      const toAdd = rows.filter(r => newlyChecked.includes(r.id));
      await addItems(toAdd);
    }
    // Newly unchecked
    const newlyUnchecked = addedIds.filter(id => !nextArr.includes(id));
    for (const id of newlyUnchecked) {
      const addedItem = ofKind.find((it) => it.ref_id === id);
      if (addedItem) onRemoveItem(addedItem.id);
    }
  };

  return (
    <div className="space-y-md" data-testid={`step-${kind}`}>
      <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary flex-1 capitalize">{resource} inventory</h3>
        <button onClick={() => setImportOpen(true)} data-testid={`import-${resource}-btn`}
          className="px-lg py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">upload</span> Import
        </button>
      </div>

      {kind === 'hotel' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {loading ? (
            <div className="col-span-3 text-center py-xl text-on-surface-variant">Loading hotels…</div>
          ) : rows.length === 0 ? (
            <div className="col-span-3 text-center py-xl text-on-surface-variant">No hotels yet — click Import to upload a supplier file.</div>
          ) : rows.map(r => (
            <label key={r.id} className={`cursor-pointer group flex flex-col rounded-xl border-2 transition-all overflow-hidden ${selectedIds.has(r.id) ? 'border-primary ring-2 ring-primary/20 bg-primary-fixed/10' : 'border-outline-variant bg-white hover:border-primary/50'}`}>
              <div className="h-32 bg-slate-100 relative overflow-hidden">
                {r.cover_image || r.image_url ? (
                  <>
                    <img 
                      src={r.cover_image || r.image_url} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                    />
                    <div style={{display: 'none'}} className="w-full h-full items-center justify-center text-on-surface-variant bg-slate-100 absolute inset-0">
                      <span className="material-symbols-outlined text-[32px]">{kind === 'flight' ? 'flight' : 'hotel'}</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-on-surface-variant absolute inset-0">
                    <span className="material-symbols-outlined text-[32px]">{kind === 'flight' ? 'flight' : 'hotel'}</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => handleToggleHotel(r, e.target.checked)} className="w-5 h-5 accent-primary rounded-full border-white/50 cursor-pointer" />
                </div>
              </div>
              <div className="p-md flex flex-col flex-1">
                <span className="font-headline-sm text-primary font-bold line-clamp-1" title={r.name}>{r.name}</span>
                <span className="text-xs text-on-surface-variant">{r.location || r.country || 'No location'} · {r.category || 'Hotel'}</span>
                <span className="mt-auto pt-sm font-label-md font-bold text-on-surface">
                  {Number(r.price_per_night || 0).toLocaleString()} <span className="text-xs font-normal text-on-surface-variant">/ night</span>
                </span>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <DynamicTable
          title={`Available ${resource}`}
          data={rows}
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={handleTableSelection}
        />
      )}

      {ofKind.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden mt-md">
          <div className="bg-surface-container-highest px-lg py-sm font-label-lg text-primary border-b border-outline-variant flex justify-between items-center">
            <span>Selected {resource}</span>
            <span className="text-sm font-normal text-on-surface-variant">Included in proposal</span>
          </div>
          <ul className="divide-y divide-outline-variant">
            {ofKind.map((it) => (
              kind === 'hotel' ? (
                <SelectedHotelItem key={it.id} it={it} onRemoveItem={onRemoveItem} onPatchItem={onPatchItem} />
              ) : (
                <li key={it.id} className="flex px-lg py-md items-center gap-md text-on-surface" data-testid={`selected-${it.id}`}>
                  <span className="font-body-md flex-1 truncate">{it.label}</span>
                  <span className="font-label-sm text-on-surface-variant">{it.qty} × {it.unit_price} {it.currency}</span>
                  <button onClick={() => onRemoveItem(it.id)} title="Remove"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </li>
              )
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
