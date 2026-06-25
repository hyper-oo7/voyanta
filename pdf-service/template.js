// Server-side HTML renderer for the three proposal styles. Output is
// self-contained: inline CSS, Google Fonts links, and uses @page for A4.

const ALL_SECTIONS = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

export function renderProposalHtml(envelope) {
  const p = envelope.proposal || {};
  const b = envelope.branding || (p.preferences && p.preferences.branding) || {};
  const presentation = envelope.presentation || {};
  const style = presentation.style || b.template_style || 'elegant';
  const include = presentation.include || Object.fromEntries(ALL_SECTIONS.map((s) => [s, true]));

  const items = envelope.items_by_kind || {};
  const total = envelope.totals?.subtotal || 0;
  const currency = envelope.totals?.currency || p.currency || 'INR';
  const days = (p.itinerary && Array.isArray(p.itinerary.days)) ? p.itinerary.days : [];
  const brief = p.brief || {};
  const adults   = num(brief.num_adults ?? p.travelers ?? 1);
  const children = num(brief.num_children ?? 0);
  const travelers = (adults + children) || num(p.travelers || 1);

  const palette = PALETTES[style] || PALETTES.elegant;
  const userAccent = b.primary_color || palette.accent;
  const accent = style === 'dark' ? (isLightOnDark(userAccent) ? userAccent : palette.accent) : userAccent;
  const font = b.font_family || palette.font;

  const sections = [];
  if (include.hero)       sections.push(heroBlock({ p, b, accent, font, palette, adults, children, travelers }));
  if (include.highlights) sections.push(sectionBlock('Highlights', accent, font, paragraphBlock(b.highlights, font, palette)));
  if (include.itinerary)  sections.push(sectionBlock('Itinerary',  accent, font, itineraryBlock(days, items, accent, font, palette)));
  if (include.hotels)     sections.push(sectionBlock('Hotels',     accent, font, hotelsBlock(items.hotel, accent, font, currency, palette)));
  if (include.costing)    sections.push(sectionBlock('Investment', accent, font, costingBlock(items, total, currency, accent, font, palette)));
  if (include.inclusions) sections.push(sectionBlock("What's Included", accent, font, paragraphBlock(b.inclusions, font, palette)));
  if (include.exclusions) sections.push(sectionBlock("What's Excluded", accent, font, paragraphBlock(b.exclusions, font, palette)));
  if (include.terms)      sections.push(sectionBlock('Terms of Payment', accent, font, paragraphBlock(b.terms_of_payment, font, palette)));
  if (include.contacts)   sections.push(sectionBlock('Contact', accent, font, contactsBlock(b, font)));
  if (include.socials)    sections.push(socialsBlock(b, font, accent));

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>${esc(p.name || 'Proposal')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cormorant+Garamond:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=DM+Serif+Display&family=EB+Garamond:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Crimson+Text:wght@400;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&family=Raleway:wght@400;500;600;700&family=Material+Symbols+Outlined&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: ${palette.body}; background: ${palette.bg}; font-family: ${font}; font-size: 11pt; line-height: 1.55; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { background: ${palette.bg}; padding: 0; }
  section.block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
  h1, h2, h3 { font-family: ${font}; margin: 0 0 8px 0; }
  h2.section { font-size: 16pt; color: ${accent}; border-bottom: 1px solid ${palette.divider}; padding-bottom: 4px; margin-bottom: 10px; letter-spacing: ${style === 'dark' ? '0.12em' : 'normal'}; text-transform: ${style === 'dark' ? 'uppercase' : 'none'}; }
  p { margin: 0 0 6px 0; }
  .muted { color: ${palette.muted}; }
  .hero { position: relative; min-height: 230px; border-radius: 8px; overflow: hidden; margin-bottom: 22px; color: #fff; }
  .hero .cover { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero .overlay { position: absolute; inset: 0; background: rgba(0,0,0,${style === 'dark' ? '0.55' : '0.32'}); }
  .hero .placeholder { position: absolute; inset: 0; background: ${accent}; }
  .hero .logo { position: absolute; top: 12px; left: 12px; max-height: 48px; max-width: 160px; background: rgba(255,255,255,0.92); border-radius: 6px; padding: 6px; }
  .hero .content { position: relative; padding: 30px 28px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; min-height: 230px; }
  .hero .kicker { font-size: 9pt; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 8px; }
  .hero h1 { font-size: 28pt; line-height: 1.05; margin: 0 0 8px 0; }
  .hero .meta { font-size: 10.5pt; opacity: 0.92; }
  table.cost { width: 100%; border-collapse: collapse; }
  table.cost td { padding: 6px 0; border-bottom: 1px solid ${palette.divider}; font-size: 11pt; }
  table.cost tr.total td { border-bottom: 0; padding-top: 10px; font-weight: 700; font-size: 14pt; color: ${accent}; }
  ul.hotels, ol.itinerary { list-style: none; padding: 0; margin: 0; }
  ul.hotels li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid ${palette.divider}; }
  ul.hotels li .amount { color: ${accent}; font-weight: 600; white-space: nowrap; margin-left: 12px; }
  ol.itinerary li { display: flex; gap: 12px; padding: 6px 0; }
  ol.itinerary .day { color: ${accent}; font-weight: 700; width: 58px; flex-shrink: 0; }
  ol.itinerary .desc { color: ${palette.muted}; font-size: 10pt; }
  .contacts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 10.5pt; }
  .contacts .full { grid-column: 1 / -1; }
  .socials { margin-top: 24px; padding-top: 12px; border-top: 1px solid ${palette.divider}; text-align: center; }
  .socials a { color: ${accent}; margin: 0 10px; text-decoration: none; }
  .page-wrap { padding: 0; }
</style>
</head>
<body>
<div class="page-wrap">
  ${sections.join('\n')}
</div>
</body></html>`;
}

const PALETTES = {
  elegant: { bg: '#f6efe3', body: '#3a2e21', accent: '#7a5b3b', divider: 'rgba(122,91,59,0.25)', muted: '#7a6b58', font: '"Cormorant Garamond", "Playfair Display", Georgia, serif' },
  dark:    { bg: '#0d1117', body: '#f3f4f6', accent: '#c8a64b', divider: 'rgba(255,255,255,0.15)', muted: 'rgba(243,244,246,0.7)', font: '"Inter", system-ui, sans-serif' },
  light:   { bg: '#ffffff', body: '#1f2937', accent: '#e89c5f', divider: 'rgba(0,0,0,0.1)', muted: '#6b7280', font: '"Inter", system-ui, sans-serif' },
};

// ── Blocks ────────────────────────────────────────────────────────────────
function heroBlock({ p, b, accent, font, palette, adults, children, travelers }) {
  const cover = b.cover_image_url || '';
  const logo  = b.logo_url || '';
  const breakdown = `${travelers} traveller${travelers === 1 ? '' : 's'}` +
    ((adults || children) ? ` · ${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}` : '');
  const heroMeta = [p.client_name ? `Curated for ${esc(p.client_name)}` : '', esc(p.destination || ''), breakdown].filter(Boolean).join(' · ');
  return `<section class="block hero" style="font-family:${font}">
    ${cover ? `<img class="cover" src="${esc(cover)}" alt="" />` : `<div class="placeholder"></div>`}
    <div class="overlay"></div>
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo" />` : ''}
    <div class="content">
      <div class="kicker">${esc(b.agency_name || 'Voyanta')}</div>
      <h1>${esc(p.name || 'Proposal')}</h1>
      <div class="meta">${heroMeta}</div>
    </div>
  </section>`;
}

function sectionBlock(title, accent, font, inner) {
  return `<section class="block" style="font-family:${font}"><h2 class="section">${esc(title)}</h2>${inner}</section>`;
}

function paragraphBlock(text, font, palette) {
  if (!text) return `<p class="muted" style="font-family:${font};font-style:italic">—</p>`;
  return `<p style="font-family:${font};white-space:pre-wrap">${esc(text)}</p>`;
}

function hotelsBlock(list, accent, font, currency, palette) {
  if (!list?.length) return `<p class="muted">No hotels selected.</p>`;
  return `<ul class="hotels" style="font-family:${font}">${list.map((it) => `
    <li><span>${esc(it.label || '')}</span><span class="amount">${((num(it.qty)) * (num(it.unit_price))).toFixed(2)} ${esc(currency || it.currency || '')}</span></li>
  `).join('')}</ul>`;
}

function itineraryBlock(days, items, accent, font, palette) {
  const fallback = (items.activity || []).map((a, i) => ({ day: i + 1, title: a.label }));
  const list = days.length ? days : fallback;
  if (!list.length) return `<p class="muted">No itinerary added.</p>`;
  return `<ol class="itinerary" style="font-family:${font}">${list.map((d, i) => `
    <li>
      <div class="day">DAY ${String(d.day || i + 1).padStart(2, '0')}</div>
      <div>
        <strong>${esc(d.title || d.label || 'Free time')}</strong>
        ${d.description ? `<div class="desc">${esc(d.description)}</div>` : ''}
      </div>
    </li>`).join('')}</ol>`;
}

function costingBlock(items, total, currency, accent, font, palette) {
  const rows = Object.entries(items).map(([kind, list]) => {
    const sub = list.reduce((s, it) => s + num(it.qty) * num(it.unit_price), 0);
    return `<tr><td style="text-transform:capitalize">${esc(kind)} (${list.length})</td><td style="text-align:right;color:${accent}">${sub.toFixed(2)} ${esc(currency)}</td></tr>`;
  }).join('');
  return `<table class="cost" style="font-family:${font}"><tbody>
    ${rows}
    <tr class="total"><td>Total</td><td style="text-align:right">${num(total).toFixed(2)} ${esc(currency)}</td></tr>
  </tbody></table>`;
}

function contactsBlock(b, font) {
  const items = [];
  if (b.contact_email) items.push(`<div>📧 ${esc(b.contact_email)}</div>`);
  if (b.contact_phone) items.push(`<div>📞 ${esc(b.contact_phone)}</div>`);
  if (b.website)       items.push(`<div>🌐 ${esc(b.website)}</div>`);
  if (b.address)       items.push(`<div class="full">📍 ${esc(b.address)}</div>`);
  if (!items.length) return `<p class="muted">No contact details set.</p>`;
  return `<div class="contacts" style="font-family:${font}">${items.join('')}</div>`;
}

function socialsBlock(b, font, accent) {
  const links = [['Facebook', b.social_facebook], ['Instagram', b.social_instagram], ['LinkedIn', b.social_linkedin]].filter(([, v]) => v);
  if (!links.length) return '';
  return `<div class="socials" style="font-family:${font}">${links.map(([n, u]) => `<a href="${esc(u)}">${n}</a>`).join('')}</div>`;
}

// ── helpers ───────────────────────────────────────────────────────────────
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function isLightOnDark(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 3 && h.length !== 6) return false;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const bl = parseInt(full.slice(4, 6), 16);
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
  return L > 0.45;
}
