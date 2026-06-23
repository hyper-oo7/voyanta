import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaAssetsLibrary_bodyClass, VoyantaAssetsLibrary_extraStyles, VoyantaAssetsLibrary_html } from './_html/voyanta_assets_library.js';

export default function AssetsLibraryPage() {
  return (
    <StitchPage
      styleId="stitch-style-assets"
      bodyClass={VoyantaAssetsLibrary_bodyClass}
      extraStyles={VoyantaAssetsLibrary_extraStyles}
      html={VoyantaAssetsLibrary_html}
      navMap={navMap}
    />
  );
}
