import { useEffect, useState } from 'react';
import { parseFile, suggestMapping, TARGET_FIELDS } from '../services/parserService.js';
import { saveImport, loadSavedMapping } from '../services/importService.js';
import { useToast } from '../context/ToastContext.jsx';
import { templatesService, itinerariesService } from '../services/resourceService.js';

// 3-step modal: Upload → Map columns / PDF Preview → Confirm.
export default function ImportModal({ resource, onClose, onImported }) {
  const toast = useToast();
  const [stage, setStage] = useState('pick');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);

  // Load any previously-saved mapping for this resource as a starting point
  useEffect(() => {
    if (resource !== 'itineraries') {
      loadSavedMapping(resource).then((m) => setMapping((p) => ({ ...m, ...p })));
    }
  }, [resource]);

  const onPick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (ext === 'pdf') {
        const result = await parseFile(f);
        setFile(f);
        setPdfResult(result);
        setStage('pdf-preview');
      } else {
        const { columns: cols, rows: rs } = await parseFile(f);
        if (!cols.length) throw new Error('No columns detected. Make sure row 1 has headers.');
        const sugg = suggestMapping(resource, cols);
        const saved = await loadSavedMapping(resource);
        // saved is { src: tgt }; merge but only for cols that exist this time
        const start = {};
        for (const c of cols) start[c] = saved[c] || sugg[c] || '';
        setFile(f); setColumns(cols); setRows(rs); setMapping(start); setStage('map');
      }
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

  const onConfirmPdf = async () => {
    setBusy(true);
    try {
      if (resource === 'templates') {
        await templatesService.create({
          name: pdfResult.name || file.name.replace('.pdf', ''),
          category: 'Imported',
          days: pdfResult.days_count,
          destination: pdfResult.destination,
          price_from: 0,
          currency: 'INR',
          data: { days: pdfResult.days }
        });
        toast.success('Successfully imported PDF as a reusable proposal template');
      } else if (resource === 'itineraries') {
        await itinerariesService.create({
          name: pdfResult.name || file.name.replace('.pdf', ''),
          days: pdfResult.days_count,
          destination: pdfResult.destination,
          price_from: 0,
          currency: 'INR',
          data: { days: pdfResult.days }
        });
        toast.success('Successfully imported PDF as a standalone itinerary');
      } else {
        throw new Error('PDF import is only supported for Templates and Itineraries');
      }
      onImported?.();
      onClose();
    } catch (err) { toast.error(err.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm" data-testid="import-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-container-lowest w-full max-w-3xl rounded-xl shadow-2xl border border-outline-variant max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-lg border-b border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-xs">
            Import {resource} <span className="font-label-sm text-on-surface-variant uppercase tracking-widest ml-sm">{stage}</span>
          </h3>
          <button onClick={onClose} data-testid="import-close" className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-lg">
          {stage === 'pick' && (
            <div className="space-y-md">
              <p className="font-body-md text-on-surface-variant">
                Upload an .xlsx, .csv, or .pdf file. Columns or itinerary structures will be detected automatically.
              </p>
              <label className="block border-2 border-dashed border-outline-variant rounded-xl p-xl text-center cursor-pointer hover:border-primary transition-colors" data-testid="import-dropzone">
                <span className="material-symbols-outlined text-[40px] text-primary">upload_file</span>
                <p className="font-label-md mt-sm">Click to choose a file</p>
                <p className="font-body-sm text-on-surface-variant">.xlsx · .csv {(resource === 'templates' || resource === 'itineraries') && '· .pdf'}</p>
                <input type="file" accept={resource === 'templates' || resource === 'itineraries' ? ".xlsx,.xls,.csv,.pdf" : ".xlsx,.xls,.csv"} onChange={onPick} className="hidden" data-testid="import-file-input" />
              </label>
              {busy && <p className="text-on-surface-variant">Parsing…</p>}
            </div>
          )}

          {stage === 'pdf-preview' && (
            <div className="space-y-md">
              <p className="font-body-md text-on-surface-variant">
                Successfully parsed the PDF itinerary! Below are the details extracted for the new template:
              </p>
              <div className="p-md rounded-lg border border-outline-variant bg-surface-container-low space-y-sm">
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block">Template Name</span>
                  <span className="font-headline-sm text-primary font-bold">{pdfResult?.name}</span>
                </div>
                {pdfResult?.destination && (
                  <div>
                    <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block">Destination</span>
                    <span className="font-body-md font-bold">{pdfResult?.destination}</span>
                  </div>
                )}
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block">Duration</span>
                  <span className="font-body-md font-bold">{pdfResult?.days_count} Days</span>
                </div>
                {pdfResult?.days && pdfResult.days.length > 0 && (
                  <div>
                    <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">Itinerary Days</span>
                    <div className="max-h-40 overflow-y-auto border border-outline-variant rounded-md p-xs space-y-xs bg-white">
                      {pdfResult.days.map((d, i) => (
                        <div key={i} className="text-xs border-b border-outline-variant pb-xs last:border-none last:pb-none">
                          <span className="font-bold text-primary mr-1 font-mono">Day {d.day}:</span>
                          <span className="font-bold">{d.title}</span>
                          <p className="text-on-surface-variant text-[11px] whitespace-pre-wrap">{d.description}</p>
                          {(d.hotels.length > 0 || d.activities.length > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                              {d.hotels.map((h, hi) => <span key={hi} className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-100">Hotel: {h}</span>)}
                              {d.activities.map((a, ai) => <span key={ai} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">Activity: {a}</span>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {busy && <p className="text-on-surface-variant">Importing…</p>}
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
          {(stage === 'map' || stage === 'pdf-preview') && (
            <button onClick={() => setStage('pick')} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Back</button>
          )}
          <button onClick={onClose} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="import-cancel">Cancel</button>
          {stage === 'map' && (
            <button onClick={onConfirm} disabled={busy} data-testid="import-confirm"
              className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md shadow-md hover:opacity-90 disabled:opacity-60">
              {busy ? 'Importing…' : `Import ${rows.length} rows`}
            </button>
          )}
          {stage === 'pdf-preview' && (
            <button onClick={onConfirmPdf} disabled={busy} data-testid="import-confirm-pdf"
              className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md shadow-md hover:opacity-90 disabled:opacity-60">
              {busy ? 'Importing…' : `Import Itinerary Template`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
