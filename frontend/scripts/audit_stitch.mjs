// Audit helper: programmatically scans all Stitch HTML body strings and
// catalogs every interactive element by page so we can plan wiring.
import fs from 'node:fs';
import path from 'node:path';

const dir = '/app/frontend/src/pages/_html';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

const report = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf-8');
  const m = src.match(/_html\s*=\s*(".*")\s*;?\s*$/s) || src.match(/_html\s*=\s*JSON\.parse\(([\s\S]+?)\);?\s*$/);
  let html = '';
  if (m) {
    try { html = JSON.parse(m[1]); } catch { /* skip */ }
  }
  if (!html) {
    const idx = src.indexOf('_html = ');
    if (idx > -1) html = src.slice(idx).match(/= (".*?");\s*$/s)?.[1] || '';
    try { html = JSON.parse(html); } catch {}
  }

  // Crude regex counts (good enough for an audit)
  const buttons   = (html.match(/<button[^>]*>/gi) || []).length;
  const anchors   = (html.match(/<a [^>]*href="([^"]*)"/gi) || []);
  const hashLinks = anchors.filter((a) => /href="#[^"]+"/.test(a) && !/href="#"/.test(a));
  const placeholders = anchors.filter((a) => /href="#"/.test(a));
  const forms     = (html.match(/<form[^>]*>/gi) || []).length;
  const inputs    = (html.match(/<input[^>]*>/gi) || []).length;

  const labels = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)]
    .map((mm) => mm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length < 60);

  report[f] = {
    buttons,
    anchors_total: anchors.length,
    anchors_section: hashLinks.length,
    anchors_placeholder: placeholders.length,
    forms,
    inputs,
    button_labels: Array.from(new Set(labels)),
  };
}

console.log(JSON.stringify(report, null, 2));
