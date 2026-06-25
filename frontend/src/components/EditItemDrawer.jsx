import { useState, useRef } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { uploadOrEmbed } from './LogoUploader.jsx';

const HIDDEN = new Set(['id', 'agency_id', 'created_at', 'updated_at', 'raw', 'created_by']);

export default function EditItemDrawer({ record, resource, service, onClose, onSaved }) {
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
      // Coerce numeric-looking fields
      for (const k of Object.keys(patch)) {
        const orig = record[k];
        if (typeof orig === 'number' && patch[k] !== null && patch[k] !== '') {
          const n = parseFloat(patch[k]); if (!isNaN(n)) patch[k] = n;
        }
      }
      await service.update(record.id, patch);
      toast.success('Saved');
      onSaved?.();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex text-on-surface" data-testid="edit-item-drawer">
      <div className="flex-1 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[480px] bg-surface-container-lowest h-full overflow-y-auto border-l border-outline-variant shadow-2xl p-xl">
        <div className="flex items-center justify-between mb-lg">
          <h3 className="font-headline-sm text-headline-sm text-primary">Edit {resource.slice(0, -1)}</h3>
          <button onClick={onClose} data-testid="edit-drawer-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-md">
          {fields.map((f) => {
            if (resource === 'hotels' && f === 'image_url') {
              const currentImages = form.raw?.images || (form.image_url ? [form.image_url] : []);
              return (
                <HotelImagesManager
                  key={f}
                  images={currentImages}
                  onChange={(newImages) => {
                    setForm((s) => ({
                      ...s,
                      image_url: newImages[0] || '',
                      raw: { ...(s.raw || {}), images: newImages }
                    }));
                  }}
                />
              );
            }
            return (
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
            );
          })}
        </div>
        <div className="flex gap-md mt-xl">
          <button onClick={onClose} className="flex-1 py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Cancel</button>
          <button onClick={onSave} disabled={saving} data-testid="edit-drawer-save"
            className="flex-1 py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function HotelImagesManager({ images, onChange }) {
  const [busy, setBusy] = useState(false);
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
      <span className="font-label-md font-bold text-primary">Hotel Photo Gallery</span>
      
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-sm">
          {images.map((img, i) => (
            <div key={i} className="group relative border border-outline-variant rounded-lg overflow-hidden bg-white h-28 flex items-center justify-center">
              <img src={img} alt={`Hotel ${i}`} className="max-w-full max-h-full object-contain" />
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
        <div className="text-center py-md border border-dashed border-outline-variant rounded-lg text-xs text-on-surface-variant italic">
          No photos added yet. Upload at least one.
        </div>
      )}

      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
        className="py-sm border border-primary text-primary hover:bg-sky-50 rounded-lg text-xs font-bold flex items-center justify-center gap-xs">
        <span className="material-symbols-outlined text-sm">upload</span>
        {busy ? 'Uploading…' : 'Upload Hotel Image'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAddImage} />
    </div>
  );
}
