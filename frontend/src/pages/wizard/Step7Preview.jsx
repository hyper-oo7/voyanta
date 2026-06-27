import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import TemplateRenderer, { ALL as ALL_SECTIONS, ExportOptionsBar } from '../../components/TemplateRenderer.jsx';
import { buildProposalExport } from '../../services/proposalItemService.js';
import { formatINR } from '../../lib/currency.js';

function A4Preview({ children }) {
  return (
    <div className="a4-host overflow-auto py-lg" data-testid="a4-preview">
      <div className="a4-paper mx-auto shadow-2xl rounded-md overflow-hidden bg-white">
        {children}
      </div>
      <style>{`
        .a4-host { background: linear-gradient(180deg, #e9eef5 0%, #dfe5ee 100%); border-radius: 12px; padding: 32px 0; }
        .a4-paper { width: 210mm; min-height: 297mm; box-shadow: 0 20px 60px rgba(11,28,48,0.18); }
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: white !important; }
          body * { visibility: hidden; }
          [data-testid="a4-preview"], [data-testid="a4-preview"] * { visibility: visible; }
          [data-testid="a4-preview"] { position: absolute; left: 0; top: 0; padding: 0; background: white; }
          .a4-paper { box-shadow: none !important; width: 210mm; min-height: 297mm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function Step7Preview({ proposalId, branding, customBlocks, proposalName }) {
  const toast = useToast();
  const [json, setJson] = useState(null);
  const [include, setInclude] = useState(ALL_SECTIONS);
  const [exportOpen, setExportOpen] = useState(false);
  const [style, setStyle] = useState(branding?.template_style || 'elegant');
  const [generating, setGenerating] = useState(false);

  const [sectionOrder, setSectionOrder] = useState(() => {
    const base = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];
    if (customBlocks) {
       customBlocks.forEach(cb => base.push(cb.id));
    }
    return base;
  });

  useEffect(() => {
    if (customBlocks && customBlocks.length > 0) {
      setSectionOrder(prev => {
        const next = [...prev];
        customBlocks.forEach(cb => {
          if (!next.includes(cb.id)) next.push(cb.id);
        });
        return next;
      });
      
      setInclude(prev => {
        const next = { ...prev };
        customBlocks.forEach(cb => {
          if (next[cb.id] === undefined) next[cb.id] = true;
        });
        return next;
      });
    }
  }, [customBlocks]);

  useEffect(() => { setStyle(branding?.template_style || 'elegant'); }, [branding?.template_style]);

  useEffect(() => {
    (async () => { if (!proposalId) return; try { setJson(await buildProposalExport(proposalId)); } catch (e) { toast.error(e.message); } })();
  }, [proposalId, toast]);

  const buildEnvelope = useCallback(() => {
    if (!json) return null;
    return { ...json, presentation: { style, include }, branding };
  }, [json, style, include, branding]);

  const onDownloadJson = () => {
    const envelope = buildEnvelope(); if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `proposal-${json.proposal?.name || proposalId}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('Proposal JSON exported');
  };

  const onGeneratePdf = async () => {
    if (!proposalId) return;
    setGenerating(true);
    try {
      const data = buildEnvelope();
      const res = await fetch('/api/pdf/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data) 
      });
      if (!res.ok) throw new Error('PDF generation failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url;
      a.download = `proposal-${proposalName || proposalId}.pdf`;
      document.body.appendChild(a); 
      a.click(); 
      a.remove(); 
      URL.revokeObjectURL(url);
      toast.success('PDF generated successfully');
    } catch (e) {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const onPrint = () => {
    window.print();
  };

  if (!proposalId) return <div className="glass-card p-xl rounded-xl text-center text-on-surface-variant" data-testid="preview-no-proposal">Save the client step first.</div>;
  if (!json) return <div className="glass-card p-xl rounded-xl text-center">Building preview…</div>;

  const merged = { ...json, proposal: { ...json.proposal, preferences: { ...(json.proposal?.preferences || {}), branding: { ...(json.proposal?.preferences?.branding || {}), ...branding } } } };

  return (
    <div className="space-y-md" data-testid="step-preview">
      <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap no-print">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Template</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)} data-testid="preview-style"
          className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
          <option value="elegant">Elegant (cream, serif)</option>
          <option value="dark">Dark Premium</option>
          <option value="light">Light & Friendly</option>
        </select>
        <span className="font-label-sm text-on-surface-variant flex-1" data-testid="preview-total">{formatINR(json.totals.subtotal||0)}</span>
        <button onClick={() => setExportOpen(true)} data-testid="open-export-modal"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">tune</span> Sections
        </button>
        <button onClick={onDownloadJson} data-testid="export-json"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">code</span> Export JSON
        </button>
        <button onClick={onPrint} data-testid="print-preview"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">print</span> Print
        </button>
        <button onClick={onGeneratePdf} disabled={generating} data-testid="generate-pdf"
          className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60 flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      <A4Preview data-testid="proposal-preview">
        <TemplateRenderer style={style} data={merged} include={include} order={sectionOrder} customBlocks={customBlocks} />
      </A4Preview>

      {exportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm no-print"
             data-testid="export-modal" onClick={(e) => e.target === e.currentTarget && setExportOpen(false)}>
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant p-lg space-y-md max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-primary">Choose sections to include</h3>
              <button onClick={() => setExportOpen(false)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-low" data-testid="export-modal-close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ExportOptionsBar value={include} onChange={setInclude} order={sectionOrder} setOrder={setSectionOrder} customBlocks={customBlocks} />
            <div className="flex justify-end gap-md">
              <button onClick={() => setInclude(ALL_SECTIONS)} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low" data-testid="export-select-all">Select all</button>
              <button onClick={() => setExportOpen(false)} className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90" data-testid="export-apply">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
