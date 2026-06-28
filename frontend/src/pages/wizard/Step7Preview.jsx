import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import TemplateRenderer, { ALL as ALL_SECTIONS, ExportOptionsBar } from '../../components/TemplateRenderer.jsx';
import { buildProposalExport } from '../../services/proposalItemService.js';
import { formatINR } from '../../lib/currency.js';

function A4Preview({ children, viewMode }) {
  return (
    <div className="a4-host overflow-auto py-lg h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#e9eef5] to-[#dfe5ee]" data-testid="a4-preview">
      <div id="pdf-render-root" className={`a4-paper shadow-2xl overflow-hidden bg-white ${viewMode === 'presentation' ? 'aspect-[210/297] h-[80vh] min-h-[auto] w-auto transition-all duration-500 rounded-xl' : 'w-[210mm] min-h-[297mm] rounded-md'}`}>
        {children}
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: white !important; }
          body * { visibility: hidden; }
          #pdf-render-root, #pdf-render-root * { visibility: visible; }
          #pdf-render-root { position: absolute; left: 0; top: 0; padding: 0; background: white; width: 210mm; min-height: 297mm; box-shadow: none !important; border-radius: 0 !important; }
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
  const [style, setStyle] = useState(branding?.template_style || 'classic');
  const [generating, setGenerating] = useState(false);
  
  const [viewMode, setViewMode] = useState('presentation'); // 'presentation' | 'document'
  const [activeSlide, setActiveSlide] = useState(0);

  const [sectionOrder, setSectionOrder] = useState(() => {
    const base = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];
    if (customBlocks) customBlocks.forEach(cb => base.push(cb.id));
    return base;
  });

  const activeKeys = sectionOrder.filter(k => include[k]);
  const numSlides = activeKeys.length;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'presentation') return;
      if (e.key === 'ArrowRight') setActiveSlide(s => Math.min(s + 1, numSlides - 1));
      if (e.key === 'ArrowLeft') setActiveSlide(s => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, numSlides]);

  useEffect(() => { setStyle(branding?.template_style || 'classic'); }, [branding?.template_style]);

  useEffect(() => {
    (async () => { if (!proposalId) return; try { setJson(await buildProposalExport(proposalId)); } catch (e) { toast.error(e.message); } })();
  }, [proposalId, toast]);

  const onDownloadJson = () => {
    if (!json) return;
    const envelope = { ...json, presentation: { style, include }, branding };
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
      // Create a document mode clone of the node to get full HTML
      const rootHtml = document.getElementById('pdf-render-root').innerHTML;
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
      
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cormorant+Garamond:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
${styles}
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { box-sizing: border-box; }
  .proposal-document section { display: block !important; break-before: page; }
  .proposal-document section:first-child { break-before: auto; }
</style>
</head>
<body>
  ${rootHtml}
</body>
</html>`;

      const res = await fetch('/api/pdf/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, name: proposalName || proposalId }) 
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

  const onPrint = () => window.print();

  if (!proposalId) return <div className="glass-card p-xl rounded-xl text-center text-on-surface-variant" data-testid="preview-no-proposal">Save the client step first.</div>;
  if (!json) return <div className="glass-card p-xl rounded-xl text-center">Building preview…</div>;

  const merged = { ...json, proposal: { ...json.proposal, preferences: { ...(json.proposal?.preferences || {}), branding: { ...(json.proposal?.preferences?.branding || {}), ...branding } } } };

  return (
    <div className="h-full flex flex-col space-y-md" data-testid="step-preview">
      <div className="glass-card p-md rounded-xl flex items-center gap-md flex-wrap no-print">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Theme</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)} data-testid="preview-style"
          className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
          <option value="modern">Modern Luxury</option>
          <option value="minimal">Minimal Editorial</option>
          <option value="dark">Dark Luxury</option>
          <option value="classic">Classic European</option>
          <option value="tropical">Tropical Escape</option>
          <option value="corporate">Corporate Executive</option>
        </select>
        
        <button onClick={() => {
          const dest = json?.proposal?.destination || 'Destination';
          const travelers = json?.proposal?.travelers || 2;
          const tType = json?.proposal?.preferences?.tour_type || 'Luxury';
          
          const prompt = `Generate a highly luxurious and captivating proposal title for a ${tType} trip to ${dest} designed for ${travelers} travelers. The title should be 3-6 words, evocative, and matching the tone of an ultra-premium travel agency. Return only the title.`;
          console.log("AI PROMPT:", prompt);
          toast.info("AI Prompt Generated. Hook up your API here!");
          
          // For now, simulate AI response
          setJson(j => ({
            ...j, 
            proposal: { 
              ...j.proposal, 
              name: `The ${dest} Experience` 
            } 
          }));
        }}
        className="px-md py-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg font-label-md flex items-center gap-2 transition-colors">
          <span className="material-symbols-outlined text-[18px]">magic_button</span>
          AI Auto-Title
        </button>

        <div className="flex bg-surface-container rounded-lg p-1 ml-auto">
          <button onClick={() => setViewMode('presentation')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'presentation' ? 'bg-white shadow text-primary' : 'text-on-surface-variant'}`}>Presentation</button>
          <button onClick={() => setViewMode('document')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'document' ? 'bg-white shadow text-primary' : 'text-on-surface-variant'}`}>Document</button>
        </div>

        <button onClick={() => setExportOpen(true)} data-testid="open-export-modal"
          className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">tune</span> Sections
        </button>
        <button onClick={onGeneratePdf} disabled={generating} data-testid="generate-pdf"
          className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60 flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        <A4Preview viewMode={viewMode}>
          <TemplateRenderer style={style} data={merged} include={include} order={sectionOrder} customBlocks={customBlocks} viewMode={viewMode} activeSlide={activeSlide} />
        </A4Preview>
        
        {viewMode === 'presentation' && (
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 no-print pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-4 text-white pointer-events-auto">
              <button onClick={() => setActiveSlide(s => Math.max(s - 1, 0))} disabled={activeSlide === 0} className="hover:text-primary-container disabled:opacity-30"><span className="material-symbols-outlined">chevron_left</span></button>
              <div className="flex gap-2 items-center">
                {activeKeys.map((k, i) => (
                  <button key={k} onClick={() => setActiveSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === activeSlide ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`} />
                ))}
              </div>
              <button onClick={() => setActiveSlide(s => Math.min(s + 1, numSlides - 1))} disabled={activeSlide === numSlides - 1} className="hover:text-primary-container disabled:opacity-30"><span className="material-symbols-outlined">chevron_right</span></button>
              <div className="ml-4 pl-4 border-l border-white/20 text-sm font-medium">Page {activeSlide + 1} of {numSlides}</div>
            </div>
          </div>
        )}
      </div>

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
