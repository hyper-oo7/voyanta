import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaAiItineraryGenerator_bodyClass, VoyantaAiItineraryGenerator_extraStyles, VoyantaAiItineraryGenerator_html } from './_html/voyanta_ai_itinerary_generator.js';

export default function AiItineraryGeneratorPage() {
  return (
    <StitchPage
      styleId="stitch-style-itinerary"
      bodyClass={VoyantaAiItineraryGenerator_bodyClass}
      extraStyles={VoyantaAiItineraryGenerator_extraStyles}
      html={VoyantaAiItineraryGenerator_html}
      navMap={navMap}
    />
  );
}
