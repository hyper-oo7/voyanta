// Three proposal template styles, all reading the same export JSON envelope.
// Sections are toggle-able via the include map (driven by the Export options modal).
// Font/color come from branding (primary_color); cover_image_url is the hero bg.

import { memo } from 'react';
import { resolveFont, TEMPLATE_DEFAULT_FONT } from '../lib/fonts.js';
import { formatINR } from '../lib/currency.js';

const TemplateRenderer = memo(function TemplateRenderer({ style = 'elegant', data, include = ALL, order = SECTIONS, customBlocks = [] }) {
  if (!data) return null;
  const Tpl = STYLES[style] || STYLES.elegant;
  return <Tpl data={data} include={include} order={order} customBlocks={customBlocks} />;
});
export default TemplateRenderer;

export const ALL = {
  hero: true, highlights: true, itinerary: true, hotels: true,
  costing: true, inclusions: true, exclusions: true, terms: true, contacts: true, socials: true,
};

export const SECTIONS = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

export function ExportOptionsBar({ value, onChange, order, setOrder, customBlocks = [] }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('index', index);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e, index) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('index'), 10);
    if (sourceIndex === index) return;
    const newOrder = [...order];
    const [draggedItem] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setOrder(newOrder);
  };

  const getLabel = (s) => {
    const cb = customBlocks.find(c => c.id === s);
    return cb ? cb.label : s;
  };

  return (
    <div className="flex flex-col gap-sm" data-testid="export-options">
      {order.map((s, index) => (
        <div key={s} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)}
          className="flex items-center gap-sm p-sm bg-surface-container-low border border-outline-variant rounded cursor-grab hover:bg-surface-container active:cursor-grabbing">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">drag_indicator</span>
          <input type="checkbox" checked={!!value[s]} onChange={() => toggle(s)} data-testid={`opt-${s}`} className="w-4 h-4 accent-primary" />
          <span className="capitalize font-label-md text-on-surface">{getLabel(s)}</span>
        </div>
      ))}
      <p className="text-xs text-on-surface-variant mt-xs">Drag and drop to reorder sections in the final output.</p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Shared bits
// ───────────────────────────────────────────────────────────────────────────
function unpack(data) {
  const p = data.proposal || {};
  const b = (p.preferences && p.preferences.branding) || {};
  const days = (p.itinerary && Array.isArray(p.itinerary.days)) ? p.itinerary.days : [];
  const brief = p.brief || {};
  const adults   = Number(brief.num_adults   ?? p.travelers ?? 1) || 0;
  const children = Number(brief.num_children ?? 0) || 0;
  const travelers = adults + children || (Number(p.travelers) || 1);
  return {
    p, b, items: data.items_by_kind || {},
    total: data.totals?.subtotal || 0,
    currency: data.totals?.currency || 'INR',
    days, adults, children, travelers,
  };
}

function Hero({ p, b, accent, dark = false, font, align = 'left', adults, children, travelers }) {
  const cover = b.cover_image_url || '';
  const logo  = b.logo_url || '';
  const breakdown = `${travelers} traveller${travelers === 1 ? '' : 's'}` +
    ((adults || children) ? ` · ${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}` : '');
  return (
    <header className="relative overflow-hidden rounded-xl mb-lg" style={{ minHeight: 380 }}>
      {cover
        ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0" style={{ background: accent }} />}
      <div className={'absolute inset-0 ' + (dark ? 'bg-black/55' : 'bg-black/30')} />
      {logo && (
        <img src={logo} alt="Agency logo"
          className="absolute top-4 left-4 z-20 h-14 max-w-[180px] object-contain bg-white/90 rounded-md p-2 shadow"
          data-testid="tpl-hero-logo" />
      )}
      <div className={'relative z-10 p-xxl text-white flex flex-col h-full justify-end ' + (align === 'center' ? 'items-center text-center' : '')}>
        <p className="font-label-md tracking-[0.3em] uppercase mb-md" style={{ fontFamily: font }}>{b.agency_name || 'Voyanta'}</p>
        <h1 className="font-display text-display leading-none" style={{ fontFamily: font, fontSize: 56 }}>{p.name || 'Proposal'}</h1>
        <p className="font-body-md mt-md max-w-xl" style={{ fontFamily: font }} data-testid="tpl-hero-meta">
          {p.client_name ? `Curated for ${p.client_name}` : ''} · {p.destination || ''} · {breakdown}
        </p>
      </div>
    </header>
  );
}

function Section({ title, accent, font, children }) {
  return (
    <section className="mb-lg">
      <h2 className="font-headline-md text-headline-md mb-md" style={{ color: accent, fontFamily: font }}>{title}</h2>
      {children}
    </section>
  );
}

function Hotels({ items, accent, font, currency, divider }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-md">
      {items.map((it) => (
        <li key={it.id} className="flex flex-col gap-xs pb-md"
            style={{ fontFamily: font, borderBottom: `1px solid ${divider || 'var(--md-sys-color-outline-variant, #c6c6cd)'}` }}>
          <div className="flex items-start justify-between w-full">
            <span className="font-semibold text-body-lg text-on-surface">{it.label}</span>
            <span className="font-label-md ml-md font-bold" style={{ color: accent }}>
              {formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
            </span>
          </div>
          {it.meta?.selected_images && it.meta.selected_images.length > 0 && (
            <div className="flex flex-wrap gap-md mt-sm">
              {it.meta.selected_images.map((imgUrl, imgIndex) => (
                <div key={imgIndex} className="w-48 h-32 rounded-lg border border-outline-variant overflow-hidden bg-surface-container-low shadow-sm">
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Itinerary({ days, items, font, accent, muted }) {
  // Use saved itinerary days when present; otherwise show "Activities" items as a fallback day-list.
  const fallback = (items.activity || []).map((a, i) => ({ day: i + 1, title: a.label }));
  const list = days.length ? days : fallback;
  if (!list.length) return null;
  return (
    <ol className="space-y-md">
      {list.map((d, i) => (
        <li key={i} className="flex gap-md" style={{ fontFamily: font }}>
          <span className="font-display flex-shrink-0 w-16" style={{ color: accent }}>{`DAY ${String(d.day || i + 1).padStart(2, '0')}`}</span>
          <div>
            <p className="font-headline-sm">{d.title || d.label || 'Free time'}</p>
            {d.description && <p className="font-body-sm" style={{ color: muted || 'var(--md-sys-color-on-surface-variant, #45464d)' }}>{d.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Costing({ items, total, currency, accent, font, divider }) {
  const groups = Object.entries(items);
  const border = `1px solid ${divider || 'var(--md-sys-color-outline-variant, #c6c6cd)'}`;
  return (
    <div className="space-y-sm" style={{ fontFamily: font }}>
      {groups.map(([kind, list]) => {
        const sub = list.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unit_price)||0), 0);
        return (
          <div key={kind} className="flex justify-between py-xs" style={{ borderBottom: border }}>
            <span className="capitalize">{kind} ({list.length})</span>
            <span style={{ color: accent }}>{formatINR(sub)}</span>
          </div>
        );
      })}
      <div className="flex justify-between pt-md font-display text-display" style={{ color: accent }}>
        <span>Total</span><span>{formatINR(total)}</span>
      </div>
    </div>
  );
}

function Paragraph({ text, font, muted }) {
  if (!text) return <p className="italic" style={{ fontFamily: font, color: muted || 'var(--md-sys-color-on-surface-variant, #45464d)' }}>—</p>;
  return <p className="whitespace-pre-wrap" style={{ fontFamily: font }}>{text}</p>;
}

function Contacts({ b, font }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-md" style={{ fontFamily: font }}>
      {b.contact_email && <div><span className="material-symbols-outlined align-middle mr-xs">mail</span>{b.contact_email}</div>}
      {b.contact_phone && <div><span className="material-symbols-outlined align-middle mr-xs">call</span>{b.contact_phone}</div>}
      {b.website       && <div><span className="material-symbols-outlined align-middle mr-xs">language</span>{b.website}</div>}
      {b.address       && <div className="md:col-span-3"><span className="material-symbols-outlined align-middle mr-xs">location_on</span>{b.address}</div>}
    </div>
  );
}

function Socials({ b, font, accent }) {
  const links = [
    ['Facebook',  b.social_facebook],
    ['Instagram', b.social_instagram],
    ['LinkedIn',  b.social_linkedin],
  ].filter(([, v]) => v);
  if (!links.length) return null;
  return (
    <footer className="mt-xxl pt-md border-t border-outline-variant flex flex-wrap gap-md justify-center" style={{ fontFamily: font, color: accent }}>
      {links.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="underline">{name}</a>)}
    </footer>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Style 1 · Elegant (Italian Escape)
// ───────────────────────────────────────────────────────────────────────────
function Elegant({ data, include, order = SECTIONS, customBlocks = [] }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const accent = b.primary_color || '#7a5b3b';
  const font = resolveFont(b, 'elegant');
  return (
    <article className="p-xl bg-[#f6efe3]" style={{ fontFamily: font }} data-testid="tpl-elegant">
      {order.map(key => {
        if (!include[key]) return null;
        switch(key) {
          case 'hero': return <Hero key={key} p={p} b={b} accent={accent} font={font} adults={adults} children={children} travelers={travelers} />;
          case 'highlights': return <Section key={key} title="The Highlights" accent={accent} font={font}><Paragraph text={b.highlights} font={font} /></Section>;
          case 'itinerary': return <Section key={key} title="The Itinerary"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} /></Section>;
          case 'hotels': return <Section key={key} title="Selected Hotels" accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} /></Section>;
          case 'costing': return <Section key={key} title="Investment" accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} /></Section>;
          case 'inclusions': return <Section key={key} title="What's Included" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} /></Section>;
          case 'exclusions': return <Section key={key} title="What's Excluded" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} /></Section>;
          case 'terms': return <Section key={key} title="Terms of Payment" accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} /></Section>;
          case 'contacts': return <Section key={key} title="Contact" accent={accent} font={font}><Contacts b={b} font={font} /></Section>;
          case 'socials': return <Socials key={key} b={b} font={font} accent={accent} />;
          default: {
            const cb = customBlocks.find(c => c.id === key);
            if (cb) {
              return (
                <Section key={key} title={cb.label} accent={accent} font={font}>
                  {cb.type === 'text' ? (
                     <Paragraph text={b[key]} font={font} />
                  ) : (
                     b[key] ? <img src={b[key]} className="w-full max-h-[400px] object-cover rounded-xl mt-sm" alt={cb.label} /> : null
                  )}
                </Section>
              );
            }
            return null;
          }
        }
      })}
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Style 2 · Dark Premium (Gangtok Leadership)
// On dark backgrounds we force a guaranteed-readable accent so a primary_color
// like deep navy doesn't disappear into the page.
// ───────────────────────────────────────────────────────────────────────────
function Dark({ data, include, order = SECTIONS, customBlocks = [] }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const userAccent = b.primary_color || '#c8a64b';
  const accent = isLightOnDark(userAccent) ? userAccent : '#c8a64b'; // gold fallback
  const font = resolveFont(b, 'dark');
  const muted = "rgba(243,244,246,0.7)";
  return (
    <article className="p-xl bg-[#0d1117] text-[#f3f4f6]" style={{ fontFamily: font }} data-testid="tpl-dark">
      {order.map(key => {
        if (!include[key]) return null;
        switch(key) {
          case 'hero': return <Hero key={key} p={p} b={b} accent={accent} dark font={font} adults={adults} children={children} travelers={travelers} />;
          case 'highlights': return <Section key={key} title="HIGHLIGHTS" accent={accent} font={font}><Paragraph text={b.highlights} font={font} muted={muted} /></Section>;
          case 'itinerary': return <Section key={key} title="ITINERARY"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} muted={muted} /></Section>;
          case 'hotels': return <Section key={key} title="HOTELS"     accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} divider="rgba(255,255,255,0.15)" /></Section>;
          case 'costing': return <Section key={key} title="INVESTMENT" accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} divider="rgba(255,255,255,0.15)" /></Section>;
          case 'inclusions': return <Section key={key} title="INCLUSIONS" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} muted={muted} /></Section>;
          case 'exclusions': return <Section key={key} title="EXCLUSIONS" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} muted={muted} /></Section>;
          case 'terms': return <Section key={key} title="TERMS"      accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} muted={muted} /></Section>;
          case 'contacts': return <Section key={key} title="CONTACT"    accent={accent} font={font}><Contacts b={b} font={font} /></Section>;
          case 'socials': return <Socials key={key} b={b} font={font} accent={accent} />;
          default: {
            const cb = customBlocks.find(c => c.id === key);
            if (cb) {
              return (
                <Section key={key} title={cb.label.toUpperCase()} accent={accent} font={font}>
                  {cb.type === 'text' ? (
                     <Paragraph text={b[key]} font={font} muted={muted} />
                  ) : (
                     b[key] ? <img src={b[key]} className="w-full max-h-[400px] object-cover rounded-xl mt-sm" alt={cb.label} /> : null
                  )}
                </Section>
              );
            }
            return null;
          }
        }
      })}
    </article>
  );
}

// Returns true when `hex` has enough luminance to read against a near-black bg.
function isLightOnDark(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 3 && h.length !== 6) return false;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const bl = parseInt(full.slice(4, 6), 16);
  // Relative luminance (WCAG)
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
  return L > 0.45;
}

// ───────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
// Style 3 · Light & Friendly (Beach Retreat)
// ───────────────────────────────────────────────────────────────────────────
function Light({ data, include, order = SECTIONS, customBlocks = [] }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const accent = b.primary_color || '#007f8a';
  const font = resolveFont(b, 'light');
  const muted = "rgba(100,116,139,1)";
  return (
    <article className="p-xl bg-white text-slate-800" style={{ fontFamily: font }} data-testid="tpl-light">
      {order.map(key => {
        if (!include[key]) return null;
        switch(key) {
          case 'hero': return <Hero key={key} p={p} b={b} accent={accent} align="center" font={font} adults={adults} children={children} travelers={travelers} />;
          case 'highlights': return <Section key={key} title="Highlights" accent={accent} font={font}><Paragraph text={b.highlights} font={font} muted={muted} /></Section>;
          case 'itinerary': return <Section key={key} title="Itinerary"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} muted={muted} /></Section>;
          case 'hotels': return <Section key={key} title="Hotels"     accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} divider="rgba(226,232,240,1)" /></Section>;
          case 'costing': return <Section key={key} title="Pricing"    accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} divider="rgba(226,232,240,1)" /></Section>;
          case 'inclusions': return <Section key={key} title="Inclusions" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} muted={muted} /></Section>;
          case 'exclusions': return <Section key={key} title="Exclusions" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} muted={muted} /></Section>;
          case 'terms': return <Section key={key} title="Terms"      accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} muted={muted} /></Section>;
          case 'contacts': return <Section key={key} title="Contact"    accent={accent} font={font}><Contacts b={b} font={font} /></Section>;
          case 'socials': return <Socials key={key} b={b} font={font} accent={accent} />;
          default: {
            const cb = customBlocks.find(c => c.id === key);
            if (cb) {
              return (
                <Section key={key} title={cb.label} accent={accent} font={font}>
                  {cb.type === 'text' ? (
                     <Paragraph text={b[key]} font={font} muted={muted} />
                  ) : (
                     b[key] ? <img src={b[key]} className="w-full max-h-[400px] object-cover rounded-xl mt-sm" alt={cb.label} /> : null
                  )}
                </Section>
              );
            }
            return null;
          }
        }
      })}
    </article>
  );
}

const STYLES = { elegant: Elegant, dark: Dark, light: Light };
