import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaLandingPage_bodyClass, VoyantaLandingPage_extraStyles, VoyantaLandingPage_html } from './_html/voyanta_landing_page.js';

export default function LandingPage() {
  return (
    <StitchPage
      styleId="stitch-style-landing"
      bodyClass={VoyantaLandingPage_bodyClass}
      extraStyles={VoyantaLandingPage_extraStyles}
      html={VoyantaLandingPage_html}
      navMap={navMap}
    />
  );
}
