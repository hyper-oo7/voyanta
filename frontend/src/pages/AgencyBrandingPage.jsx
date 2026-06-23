import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaAgencyBranding_bodyClass, VoyantaAgencyBranding_extraStyles, VoyantaAgencyBranding_html } from './_html/voyanta_agency_branding.js';

export default function AgencyBrandingPage() {
  return (
    <StitchPage
      styleId="stitch-style-branding"
      bodyClass={VoyantaAgencyBranding_bodyClass}
      extraStyles={VoyantaAgencyBranding_extraStyles}
      html={VoyantaAgencyBranding_html}
      navMap={navMap}
    />
  );
}
