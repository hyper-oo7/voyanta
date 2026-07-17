import { useState, useRef, memo } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { uploadOrEmbed } from './LogoUploader.jsx';
import { motion } from 'framer-motion';
import ImageSearchPicker from './common/ImageSearchPicker.jsx';

const HIDDEN = new Set(['id', 'agency_id', 'created_at', 'updated_at', 'raw', 'created_by']);

export default function EditItemDrawer({ item: record, resource, service, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...record });
  const [saving, setSaving] = useState(false);
  const fields = Object.keys(record).filter((k) => !HIDDEN.has(k));

  const upd = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, agency_id, created_at, updated_at, ...patch } = form;
      
      // Coerce fields based on resource type
      if (resource === 'hotels') {
        if (typeof patch.price_per_night === 'string') patch.price_per_night = parseFloat(patch.price_per_night) || 0;
        if (typeof patch.rating === 'string') patch.rating = parseFloat(patch.rating) || 0;
        if (typeof patch.amenities === 'string') {
          patch.amenities = patch.amenities.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else if (resource === 'flights') {
        if (typeof patch.cost === 'string') patch.cost = parseFloat(patch.cost) || 0;
      } else if (resource === 'activities') {
        if (typeof patch.price === 'string') patch.price = parseFloat(patch.price) || 0;
        if (typeof patch.duration_hours === 'string') patch.duration_hours = parseFloat(patch.duration_hours) || 0;
      } else {
        // Fallback coercion for generic resources
        for (const k of Object.keys(patch)) {
          const orig = record[k];
          if (typeof orig === 'number' && patch[k] !== null && patch[k] !== '') {
            const n = parseFloat(patch[k]); if (!isNaN(n)) patch[k] = n;
          }
        }
      }
      
      await service.update(record.id, patch);
      toast.success('Saved');
      onSaved?.();
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const renderFields = () => {
    if (resource === 'hotels') {
      return (
        <>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md">Hotel Name</span>
            <input value={form.name ?? ''} onChange={upd('name')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md">Location</span>
            <input value={form.location ?? ''} onChange={upd('location')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md">Country</span>
            <input value={form.country ?? ''} onChange={upd('country')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
          </label>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Category</span>
              <input value={form.category ?? ''} onChange={upd('category')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" placeholder="e.g. Luxury, Boutique" />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Rating</span>
              <input type="number" min="0" max="5" step="0.1" value={form.rating ?? ''} onChange={upd('rating')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Price per Night</span>
              <input type="number" min="0" value={form.price_per_night ?? ''} onChange={upd('price_per_night')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Currency</span>
              <input value={form.currency ?? 'INR'} onChange={upd('currency')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
          </div>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md">Amenities (comma-separated)</span>
            <input 
              value={Array.isArray(form.amenities) ? form.amenities.join(', ') : (form.amenities ?? '')} 
              onChange={upd('amenities')} 
              placeholder="e.g. WiFi, Pool, Spa"
              className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" 
            />
          </label>
          <HotelImagesManager
            images={form.raw?.images || (form.image_url ? [form.image_url] : [])}
            onChange={(newImages) => {
              setForm((s) => ({
                ...s,
                image_url: newImages[0] || '',
                raw: { ...(s.raw || {}), images: newImages }
              }));
            }}
          />
        </>
      );
    }
    
    if (resource === 'flights') {
      return (
        <>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Airline</span>
              <input value={form.airline ?? ''} onChange={upd('airline')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Flight No</span>
              <input value={form.flight_no ?? ''} onChange={upd('flight_no')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Origin</span>
              <input value={form.origin ?? ''} onChange={upd('origin')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" placeholder="e.g. JFK" />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Destination</span>
              <input value={form.destination ?? ''} onChange={upd('destination')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" placeholder="e.g. CDG" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Class</span>
              <select value={form.class ?? 'Economy'} onChange={upd('class')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
                <option value="Economy">Economy</option>
                <option value="Premium Economy">Premium Economy</option>
                <option value="Business">Business</option>
                <option value="First">First</option>
              </select>
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Duration</span>
              <input value={form.duration ?? ''} onChange={upd('duration')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" placeholder="e.g. 7h 45m" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Cost</span>
              <input type="number" min="0" value={form.cost ?? ''} onChange={upd('cost')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md">Currency</span>
              <input value={form.currency ?? 'INR'} onChange={upd('currency')} className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
            </label>
          </div>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md">Departure Date</span>
            <input type="date" value={form.depart_date ? String(form.depart_date).slice(0, 10) : ''} onChange={upd('depart_date')} className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
          </label>
        </>
      );
    }
    
    // Fallback to dynamic fields
    return fields.map((f) => (
      <label key={f} className="flex flex-col gap-xs">
        <span className="font-label-md text-label-md capitalize">{f.replace(/_/g, ' ')}</span>
        {typeof record[f] === 'string' && record[f]?.length > 80 ? (
          <textarea value={form[f] ?? ''} onChange={upd(f)} rows={3}
            className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
        ) : (
          <input value={form[f] ?? ''} onChange={upd(f)} data-testid={`edit-${f}`}
            className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
        )}
      </label>
    ));
  };

  return (
    <div className="fixed inset-0 z-[80] flex text-on-surface" data-testid="edit-item-drawer">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <div className="flex-1" />
      <motion.aside 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-[480px] bg-surface-container-lowest h-full overflow-y-auto border-l border-outline-variant shadow-2xl p-xl">
        <div className="flex items-center justify-between mb-lg">
          <h3 className="font-headline-sm text-headline-sm text-primary">Edit {resource.slice(0, -1)}</h3>
          <button onClick={onClose} data-testid="edit-drawer-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-md">
          {renderFields()}
        </div>
        <div className="flex gap-md mt-xl">
          <button onClick={onClose} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Cancel</button>
          <button onClick={onSave} disabled={saving} data-testid="edit-drawer-save"
            className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.aside>
    </div>
  );
}

function HotelImagesManager({ images, onChange }) {
  const [busy, setBusy] = useState(false);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const fileRef = useRef(null);

  const onAddImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadOrEmbed(file, 'hotels');
      onChange([...images, url]);
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const onMove = (index, dir) => {
    const copy = [...images];
    const target = index + dir;
    if (target < 0 || target >= copy.length) return;
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    onChange(copy);
  };

  return (
    <div className="flex flex-col gap-sm border border-outline-variant rounded-xl p-md bg-slate-50 text-on-surface">
      {showStockPicker && (
        <ImageSearchPicker
          onSelect={(url) => {
            onChange([...images, url]);
            setShowStockPicker(false);
          }}
          onClose={() => setShowStockPicker(false)}
          defaultQuery="luxury hotel"
        />
      )}
      <span className="font-label-md font-bold text-primary">Photo Gallery (Hotels, Activities & Cruises)</span>
      
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-sm">
          {images.map((img, i) => (
            <div key={i} className="group relative border border-outline-variant rounded-lg overflow-hidden bg-white h-28 flex items-center justify-center">
              <img src={img} alt={`Gallery ${i}`} className="max-w-full max-h-full object-contain" />
              {i === 0 && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-on-primary text-[9px] font-bold rounded shadow-sm">
                  Primary
                </span>
              )}
              {/* Overlay controls */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-xs">
                <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} title="Move Up/Left"
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <button type="button" onClick={() => onMove(i, 1)} disabled={i === images.length - 1} title="Move Down/Right"
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
                <button type="button" onClick={() => onRemove(i)} title="Delete Photo"
                  className="w-8 h-8 rounded-full bg-error/20 hover:bg-error text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant italic">No images in gallery</p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          type="button"
          onClick={() => setShowStockPicker(true)}
          className="flex items-center justify-center gap-1.5 p-2 bg-secondary text-on-secondary rounded-lg cursor-pointer hover:bg-secondary/90 text-xs font-bold transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">photo_library</span>
          Stock Photos
        </button>
        <label className="flex items-center justify-center gap-1.5 p-2 bg-white border border-outline-variant rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold transition-all shadow-sm text-primary">
          <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
          {busy ? 'Uploading...' : 'Upload Image'}
          <input type="file" ref={fileRef} accept="image/*" onChange={onAddImage} className="hidden" />
        </label>
      </div>
    </div>
  );
}
