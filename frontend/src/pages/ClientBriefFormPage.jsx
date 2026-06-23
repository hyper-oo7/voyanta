import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaClientBriefForm_bodyClass, VoyantaClientBriefForm_extraStyles, VoyantaClientBriefForm_html } from './_html/voyanta_client_brief_form.js';

export default function ClientBriefFormPage() {
  return (
    <StitchPage
      styleId="stitch-style-brief"
      bodyClass={VoyantaClientBriefForm_bodyClass}
      extraStyles={VoyantaClientBriefForm_extraStyles}
      html={VoyantaClientBriefForm_html}
      navMap={navMap}
    />
  );
}
