import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import TemplateRenderer, { ALL as ALL_SECTIONS, THEMES } from '../components/TemplateRenderer.jsx';
import { buildProposalExport } from '../services/proposalItemService.js';

export default function ProposalPrintRoute() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [json, setJson] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    buildProposalExport(id)
      .then((data) => {
        if (mounted) {
          setJson(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load proposal data');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface font-body-md text-on-surface-variant">
        Preparing document for printing...
      </div>
    );
  }

  if (error || !json) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface text-error font-body-md p-lg text-center">
        Error: {error || 'Proposal not found'}
      </div>
    );
  }

  const p = json.proposal || {};
  const b = p.preferences?.branding || {};
  const style = searchParams.get('style') || b.template_style || 'classic';
  const themeBg = THEMES[style]?.bg || '#ffffff';
  const themeText = THEMES[style]?.text || '#000000';

  return (
    <div id="pdf-render-root" className="min-h-screen" style={{ backgroundColor: themeBg, color: themeText }}>
      <style>{`
        @page { size: A4; margin: 0; }
        body, html, #pdf-render-root { margin: 0; padding: 0; background: ${themeBg} !important; color: ${themeText} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html.dark #pdf-render-root, html.dark #pdf-render-root * { color-scheme: light !important; }
        .proposal-document section { display: block !important; break-before: auto !important; page-break-before: auto !important; }
        h1, h2, h3, h4, .editorial-section h2, .editorial-section h3 { break-after: avoid !important; page-break-after: avoid !important; }
        .break-inside-avoid, .page-break-inside-avoid, li.break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
        .no-print { display: none !important; }
      `}</style>
      <TemplateRenderer 
        data={json} 
        include={ALL_SECTIONS} 
        style={style} 
        viewMode="document" 
      />
    </div>
  );
}
