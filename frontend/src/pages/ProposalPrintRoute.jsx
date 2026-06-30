import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TemplateRenderer, { ALL as ALL_SECTIONS } from '../components/TemplateRenderer.jsx';
import { buildProposalExport } from '../services/proposalItemService.js';

export default function ProposalPrintRoute() {
  const { id } = useParams();
  const [json, setJson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await buildProposalExport(id);
        setJson(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  if (error) {
    return <div className="p-8 text-red-500">Error generating print view: {error}</div>;
  }

  if (!json) {
    return <div className="p-8 text-gray-500">Loading document for print...</div>;
  }

  const p = json.proposal || {};
  const b = p.preferences?.branding || {};
  const style = b.template_style || 'classic';

  return (
    <div id="pdf-render-root" className="bg-white min-h-screen">
      <style>{`
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .proposal-document section { display: block !important; break-before: page; }
        .proposal-document section:first-child { break-before: auto; }
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
