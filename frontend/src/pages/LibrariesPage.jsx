import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaLibraries_bodyClass, VoyantaLibraries_extraStyles, VoyantaLibraries_html } from './_html/voyanta_libraries.js';

export default function LibrariesPage() {
  return (
    <StitchPage
      styleId="stitch-style-libraries"
      bodyClass={VoyantaLibraries_bodyClass}
      extraStyles={VoyantaLibraries_extraStyles}
      html={VoyantaLibraries_html}
      navMap={navMap}
    />
  );
}
