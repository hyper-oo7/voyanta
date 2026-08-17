import { useState, useCallback } from 'react';
import { parsePdfFile, parseFile } from '../services/parserService';
import { getAgencyId } from '../lib/supabaseClient.js';
import { logger } from '../utils/logger';

export default function ImportModal({ resource, onClose, onImported, agencyId = getAgencyId() }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | extracting | success | error
  const [progress, setProgress] = useState(null);
  const [pdfResult, setPdfResult] = useState(null);
  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isPdf = (f) => (f?.name.split('.').pop() || '').toLowerCase() === 'pdf';

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setStatus('idle');
      setErrorMsg('');
      setRawText('');
      setPdfResult(null);
    }
  }, []);

  const handleProcess = async () => {
    if (!file) return;

    if (isPdf(file)) {
      setStatus('uploading');
      setErrorMsg('');
      setRawText('');
      setPdfResult(null);

      try {
        setStatus('extracting');
        const result = await parsePdfFile(file, {
          agencyId,
          onProgress: (p) => setProgress(p),
        });

        setPdfResult(result);
        setStatus('success');
      } catch (err) {
        logger.error('PDF extraction failed:', err);
        setErrorMsg(err.message || 'Failed to extract PDF');
        setRawText(err.rawText || '');
        setStatus('error');
      }
    } else {
      // CSV / XLSX — immediate client-side parse
      setStatus('uploading');
      try {
        const { rows } = await parseFile(file);
        setStatus('idle');
        onImported(rows?.length || 0, { rows });
        onClose();
      } catch (err) {
        setErrorMsg(err.message || 'Failed to parse file');
        setStatus('error');
      }
    }
  };

  const handleImportExtracted = () => {
    if (!pdfResult) return;

    let count = 0;
    if (resource === 'templates' || resource === 'itineraries') {
      count = pdfResult.days?.length || 0;
    } else {
      count = pdfResult[resource]?.length || 0;
    }

    onImported(count, pdfResult);
    onClose();
  };

  const reset = () => {
    setStatus('idle');
    setFile(null);
    setErrorMsg('');
    setRawText('');
    setPdfResult(null);
    setProgress(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Import {resource}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* IDLE — File picker */}
        {status === 'idle' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="import-file-input"
              />
              <label htmlFor="import-file-input" className="cursor-pointer block">
                <p className="text-gray-700 font-medium mb-1">Drop file here or click to browse</p>
                <p className="text-sm text-gray-400">Supports PDF, CSV, XLSX</p>
              </label>
            </div>

            {file && (
              <div className="p-3 bg-gray-50 rounded-lg border text-sm text-gray-700 flex items-center justify-between">
                <span className="truncate max-w-[80%]">📄 {file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                  Remove
                </button>
              </div>
            )}

            {file && (
              <button
                onClick={handleProcess}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                {isPdf(file) ? 'Start AI Extraction' : 'Parse File'}
              </button>
            )}
          </div>
        )}

        {/* UPLOADING / EXTRACTING — Progress */}
        {(status === 'uploading' || status === 'extracting') && (
          <div className="py-10 text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-gray-800 font-medium">
              {status === 'uploading' ? 'Uploading PDF…' : 'AI is reading your document…'}
            </p>
            {progress && (
              <div className="mt-5 max-w-sm mx-auto">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{
                      width: progress.total
                        ? `${Math.min((progress.current / progress.total) * 100, 100)}%`
                        : '10%',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">
                  {progress.stage}
                  {progress.total > 0 && ` • ${progress.current} / ${progress.total}`}
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">This may take up to a minute for large files.</p>
          </div>
        )}

        {/* SUCCESS — Review extracted data */}
        {status === 'success' && pdfResult && (
          <div className="space-y-4">
            {pdfResult.destination && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-sm text-blue-600 font-medium">Destination</span>
                <span className="text-gray-900 font-semibold">{pdfResult.destination}</span>
              </div>
            )}

            {resource === 'templates' || resource === 'itineraries' ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Duration:</span> {pdfResult.days_count} Days
                </div>
                {pdfResult.days?.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Itinerary Days
                    </div>
                    {pdfResult.days.map((d, i) => (
                      <div key={i} className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">Day {d.day}: {d.title}</p>
                        {d.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm font-medium text-gray-700">Extracted {resource}</p>
                {resource === 'hotels' && (pdfResult?.hotels || []).map((h, i) => (
                  <div key={i} className="p-3 border rounded-lg text-sm">
                    <p className="font-medium text-gray-900">{h.name}</p>
                    <p className="text-gray-500">{h.location || pdfResult.destination || 'Unknown Location'}</p>
                  </div>
                ))}
                {resource === 'flights' && (pdfResult?.flights || []).map((f, i) => (
                  <div key={i} className="p-3 border rounded-lg text-sm">
                    <p className="font-medium text-gray-900">{f.airline} <span className="text-gray-500">({f.flight_no})</span></p>
                  </div>
                ))}
                {resource === 'activities' && (pdfResult?.activities || []).map((a, i) => (
                  <div key={i} className="p-3 border rounded-lg text-sm">
                    <p className="font-medium text-gray-900">{a.name}</p>
                  </div>
                ))}
                {(!pdfResult[resource] || pdfResult[resource].length === 0) && (
                  <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    No {resource} found in this PDF. You can still import the itinerary structure.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleImportExtracted}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Import Extracted Data
              </button>
              <button
                onClick={reset}
                className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* ERROR — Show message + raw text fallback */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-red-800 font-semibold text-sm">Extraction Failed</p>
              <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
            </div>

            {rawText && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raw Extracted Text <span className="text-gray-400 font-normal">— copy-paste manually</span>
                </label>
                <textarea
                  readOnly
                  value={rawText}
                  rows={10}
                  className="w-full p-3 border rounded-lg text-xs font-mono bg-gray-50 text-gray-700 focus:outline-none resize-y"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(rawText)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
