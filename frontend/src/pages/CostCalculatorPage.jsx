import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaCostCalculator_bodyClass, VoyantaCostCalculator_extraStyles, VoyantaCostCalculator_html } from './_html/voyanta_cost_calculator.js';

export default function CostCalculatorPage() {
  return (
    <StitchPage
      styleId="stitch-style-cost"
      bodyClass={VoyantaCostCalculator_bodyClass}
      extraStyles={VoyantaCostCalculator_extraStyles}
      html={VoyantaCostCalculator_html}
      navMap={navMap}
    />
  );
}
