import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaAuthentication_bodyClass, VoyantaAuthentication_extraStyles, VoyantaAuthentication_html } from './_html/voyanta_authentication.js';

export default function AuthenticationPage() {
  return (
    <StitchPage
      styleId="stitch-style-auth"
      bodyClass={VoyantaAuthentication_bodyClass}
      extraStyles={VoyantaAuthentication_extraStyles}
      html={VoyantaAuthentication_html}
      navMap={navMap}
    />
  );
}
