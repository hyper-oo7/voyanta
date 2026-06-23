// Build script: extracts <body> content from each Stitch HTML page
// and writes them as JS modules to src/pages/_html/
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = '/tmp/stitch_extracted/stitch_voyanta_travel_proposal_suite';
const OUT_DIR = '/app/frontend/src/pages/_html';

const PAGES = [
  'voyanta_landing_page',
  'voyanta_authentication',
  'voyanta_dashboard',
  'voyanta_ai_itinerary_generator',
  'voyanta_client_brief_form',
  'voyanta_proposal_preview',
  'voyanta_cost_calculator',
  'voyanta_libraries',
  'voyanta_hotel_library',
  'voyanta_assets_library',
  'voyanta_agency_branding',
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const slug of PAGES) {
  const filePath = path.join(SRC_DIR, slug, 'code.html');
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Extract body content
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    console.warn('No body in', slug);
    continue;
  }
  let body = bodyMatch[1];

  // Extract body class
  const bodyClassMatch = raw.match(/<body[^>]*class="([^"]*)"/i);
  const bodyClass = bodyClassMatch ? bodyClassMatch[1] : '';

  // Strip <script> tags inside body (they reference DOM ids that won't exist post-React-render
  // anyway, and modal logic is reimplemented in React)
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Extract page-specific <style> from <head> and inline into body
  const headMatch = raw.match(/<head[\s\S]*?>([\s\S]*?)<\/head>/i);
  let extraStyles = '';
  if (headMatch) {
    const styleMatches = headMatch[1].matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    for (const m of styleMatches) {
      extraStyles += m[1] + '\n';
    }
  }

  const exportName = slug.replace(/_(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());

  const moduleSrc = `// Auto-generated from Stitch HTML: ${slug}
export const ${exportName}_bodyClass = ${JSON.stringify(bodyClass)};
export const ${exportName}_extraStyles = ${JSON.stringify(extraStyles.trim())};
export const ${exportName}_html = ${JSON.stringify(body)};
`;

  const outFile = path.join(OUT_DIR, `${slug}.js`);
  fs.writeFileSync(outFile, moduleSrc);
  console.log('Wrote', outFile, '(' + body.length + ' chars)');
}
