import { useEffect, useState } from 'react';
import { parseFile, suggestMapping, TARGET_FIELDS } from '../services/parserService.js';
import { saveImport, loadSavedMapping } from '../services/importService.js';
import { useToast } from '../context/ToastContext.jsx';

// 3-step modal: Upload → Map columns → Confirm.
export default function ImportModal({ resource, onClose, onImported }) {
  const toast = useToast();
  const [stage, setStage] = useState('pick');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);

  // Load any previously-saved mapping for this resource as a starting point
  useEffect(() => { loadSavedMapping(resource).then((m) => setMapping((p) => ({ ...m, ...p }))); }, [resource]);

  const onPick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const { columns: cols, rows: rs } = await parseFile(f);
      if (!cols.length) throw new Error('No columns detected. Make sure row 1 has headers.');
      const sugg = suggestMapping(resource, cols);
      const saved = await loadSavedMapping(resource);
      // saved is { src: tgt }; merge but only for cols that exist this time
      const start = {};
      for (const c of cols) start[c] = saved[c] || sugg[c] || '';
      setFile(f); setColumns(cols); setRows(rs); setMapping(start); setStage('map');
    } catch (err) { toast.error(err.message || 'Failed to parse file'); }
    finally { setBusy(false); }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const fileFormat = ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'csv';
      const cleanMapping = {};
      for (const [src, tgt] of Object.entries(mapping)) if (tgt) cleanMapping[src] = tgt;
      const { inserted_count } = await saveImport({
        resource, filename: file.name, fileFormat, columns, rows, mapping: cleanMapping,
      });
      toast.success(`Imported ${inserted_count} ${resource}`);
      onImported?.();
      onClose();
    } catch (err) { toast.error(err.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm" data-testid="import-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-container-lowest w-full max-w-3xl rounded-xl shadow-2xl border border-outline-variant max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-lg border-b border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-primary">
            Import {resource} <span className="font-label-sm text-on-surface-variant uppercase tracking-widest ml-sm">{stage}</span>
          </h3>
          <button onClick={onClose} data-testid="import-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-lg">
          {stage === 'pick' && (
            <div className="space-y-md">
              <p className="font-body-md text-on-surface-variant">Upload an .xlsx or .csv file. Columns will be detected automatically.</p>
              <label className="block border-2 border-dashed border-outline-variant rounded-xl p-xl text-center cursor-pointer hover:border-primary transition-colors" data-testid="import-dropzone">
                <span className="material-symbols-outlined text-[40px] text-primary">upload_file</span>
                <p className="font-label-md mt-sm">Click to choose a file</p>
                <p className="font-body-sm text-on-surface-variant">.xlsx · .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onPick} className="hidden" data-testid="import-file-input" />
              </label>
              {busy && <p className="text-on-surface-variant">Parsing…</p>}
            </div>
          )}

          {stage === 'map' && (
            <div className="space-y-md">
              <p className="font-body-md">
                Detected <b>{columns.length}</b> columns and <b>{rows.length}</b> rows. Map each column to a Travel OS field
                (or leave blank to keep it only inside the raw record).
              </p>
              <div className="rounded-lg border border-outline-variant overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-surface-container">
                    <tr>
                      <th className="px-md py-sm font-label-sm text-label-sm uppercase tracking-wider">Source column</th>
                      <th className="px-md py-sm font-label-sm text-label-sm uppercase tracking-wider">Travel OS field</th>
                      <th className="px-md py-sm font-label-sm text-label-sm uppercase tracking-wider">Sample</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {columns.map((c) => (
                      <tr key={c}>
                        <td className="px-md py-sm font-label-md">{c}</td>
                        <td className="px-md py-sm">
                          <select className="w-full px-sm py-xs border border-outline-variant rounded bg-white" data-testid={`map-${c}`}
                            value={mapping[c] || ''} onChange={(e) => setMapping((m) => ({ ...m, [c]: e.target.value }))}>
                            <option value="">— skip —</option>
                            {TARGET_FIELDS[resource].map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                        <td className="px-md py-sm font-body-sm text-on-surface-variant truncate max-w-[200px]">{String(rows[0]?.[c] ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-lg border-t border-outline-variant flex justify-end gap-md">
          {stage === 'map' && (
            <button onClick={() => setStage('pick')} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Back</button>
          )}
          <button onClick={onClose} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="import-cancel">Cancel</button>
          {stage === 'map' && (
            <button onClick={onConfirm} disabled={busy} data-testid="import-confirm"
              className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md shadow-md hover:opacity-90 disabled:opacity-60">
              {busy ? 'Importing…' : `Import ${rows.length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
