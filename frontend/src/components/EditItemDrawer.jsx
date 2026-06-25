// Generic edit drawer for any imported inventory row (hotels/flights/activities/templates).
// Auto-derives editable fields from the record keys (skipping system fields).
// Saves via the per-resource service.update().

import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';

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
    <div className="fixed inset-0 z-[80] flex" data-testid="edit-item-drawer">
      <div className="flex-1 bg-on-surface/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[480px] bg-surface-container-lowest h-full overflow-y-auto border-l border-outline-variant shadow-2xl p-xl">
        <div className="flex items-center justify-between mb-lg">
          <h3 className="font-headline-sm text-headline-sm text-primary">Edit {resource.slice(0, -1)}</h3>
          <button onClick={onClose} data-testid="edit-drawer-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-md">
          {fields.map((f) => (
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
          ))}
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
