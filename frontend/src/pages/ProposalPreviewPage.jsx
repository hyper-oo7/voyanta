import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaProposalPreview_bodyClass, VoyantaProposalPreview_extraStyles, VoyantaProposalPreview_html } from './_html/voyanta_proposal_preview.js';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProposalById } from '../services/proposalService.js';
import { listItems } from '../services/proposalItemService.js';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';
import { logger } from '../utils/logger.js';
import { useBackendHealth } from '../context/BackendHealthContext.jsx';

export default function ProposalPreviewPage() {
  const { id } = useParams();
  const { isHealthy } = useBackendHealth();
  const { showToast } = useToast();

  useEffect(() => {
    const btn = document.getElementById('export-pdf-btn');
    if (!btn) return;

    const handleExport = async (e) => {
      e.preventDefault();
      try {
        showToast('Generating PDF... This may take a few seconds.', 'info');
        // Fetch full proposal details and items
        const [p, its] = await Promise.all([fetchProposalById(id), listItems(id)]);
        const payload = { proposal: p, items: its };
        
        const blob = await api.post('/api/pdf/generate', payload, { responseType: 'blob' });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.name || 'proposal'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast('PDF Exported Successfully!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
        logger.error('PDF Export Error:', err);
      }
    };

    btn.addEventListener('click', handleExport);
    return () => btn.removeEventListener('click', handleExport);
  }, [id, showToast]);

  return (
    <StitchPage
      styleId="stitch-style-preview"
      bodyClass={VoyantaProposalPreview_bodyClass}
      extraStyles={VoyantaProposalPreview_extraStyles}
      html={VoyantaProposalPreview_html}
      navMap={navMap}
    />
  );
}
