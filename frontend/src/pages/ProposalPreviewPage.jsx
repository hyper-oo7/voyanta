import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaProposalPreview_bodyClass, VoyantaProposalPreview_extraStyles, VoyantaProposalPreview_html } from './_html/voyanta_proposal_preview.js';

export default function ProposalPreviewPage() {
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
