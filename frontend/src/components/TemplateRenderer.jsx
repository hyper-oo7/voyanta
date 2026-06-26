// Three proposal template styles, all reading the same export JSON envelope.
// Sections are toggle-able via the include map (driven by the Export options modal).
// Font/color come from branding (primary_color); cover_image_url is the hero bg.

import { memo } from 'react';
import { resolveFont, TEMPLATE_DEFAULT_FONT } from '../lib/fonts.js';
import { formatINR } from '../lib/currency.js';

const TemplateRenderer = memo(function TemplateRenderer({ style = 'elegant', data, include = ALL }) {
  if (!data) return null;
  const Tpl = STYLES[style] || STYLES.elegant;
  return <Tpl data={data} include={include} />;
});
export default TemplateRenderer;

export const ALL = {
  hero: true, highlights: true, itinerary: true, hotels: true,
  costing: true, inclusions: true, exclusions: true, terms: true, contacts: true, socials: true,
};

const SECTIONS = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

export function ExportOptionsBar({ value, onChange }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  return (
    <div className="flex flex-wrap gap-md" data-testid="export-options">
      {SECTIONS.map((s) => (
        <label key={s} className="flex items-center gap-xs font-label-md text-label-md text-on-surface select-none cursor-pointer">
          <input type="checkbox" checked={!!value[s]} onChange={() => toggle(s)} data-testid={`opt-${s}`} />
          <span className="capitalize">{s}</span>
        </label>
      ))}
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
function Elegant({ data, include }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const accent = b.primary_color || '#7a5b3b';
  const font = resolveFont(b, 'elegant');
  return (
    <article className="p-xl bg-[#f6efe3]" style={{ fontFamily: font }} data-testid="tpl-elegant">
      {include.hero && <Hero p={p} b={b} accent={accent} font={font} adults={adults} children={children} travelers={travelers} />}
      {include.highlights && <Section title="The Highlights" accent={accent} font={font}><Paragraph text={b.highlights} font={font} /></Section>}
      {include.itinerary  && <Section title="The Itinerary"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} /></Section>}
      {include.hotels     && <Section title="Selected Hotels" accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} /></Section>}
      {include.costing    && <Section title="Investment" accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} /></Section>}
      {include.inclusions && <Section title="What's Included" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} /></Section>}
      {include.exclusions && <Section title="What's Excluded" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} /></Section>}
      {include.terms      && <Section title="Terms of Payment" accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} /></Section>}
      {include.contacts   && <Section title="Contact" accent={accent} font={font}><Contacts b={b} font={font} /></Section>}
      {include.socials    && <Socials b={b} font={font} accent={accent} />}
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Style 2 · Dark Premium (Gangtok Leadership)
// On dark backgrounds we force a guaranteed-readable accent so a primary_color
// like deep navy doesn't disappear into the page.
// ───────────────────────────────────────────────────────────────────────────
function Dark({ data, include }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const userAccent = b.primary_color || '#c8a64b';
  const accent = isLightOnDark(userAccent) ? userAccent : '#c8a64b'; // gold fallback
  const font = resolveFont(b, 'dark');
  return (
    <article className="p-xl bg-[#0d1117] text-[#f3f4f6]" style={{ fontFamily: font }} data-testid="tpl-dark">
      {include.hero && <Hero p={p} b={b} accent={accent} dark font={font} adults={adults} children={children} travelers={travelers} />}
      {include.highlights && <Section title="HIGHLIGHTS" accent={accent} font={font}><Paragraph text={b.highlights} font={font} muted="rgba(243,244,246,0.7)" /></Section>}
      {include.itinerary  && <Section title="ITINERARY"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} muted="rgba(243,244,246,0.7)" /></Section>}
      {include.hotels     && <Section title="HOTELS"     accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} divider="rgba(255,255,255,0.15)" /></Section>}
      {include.costing    && <Section title="INVESTMENT" accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} divider="rgba(255,255,255,0.15)" /></Section>}
      {include.inclusions && <Section title="INCLUSIONS" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} muted="rgba(243,244,246,0.7)" /></Section>}
      {include.exclusions && <Section title="EXCLUSIONS" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} muted="rgba(243,244,246,0.7)" /></Section>}
      {include.terms      && <Section title="TERMS"      accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} muted="rgba(243,244,246,0.7)" /></Section>}
      {include.contacts   && <Section title="CONTACT"    accent={accent} font={font}><Contacts b={b} font={font} /></Section>}
      {include.socials    && <Socials b={b} font={font} accent={accent} />}
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
// Style 3 · Light & Friendly (Family Memories)
// ───────────────────────────────────────────────────────────────────────────
function Light({ data, include }) {
  const { p, b, items, total, currency, days, adults, children, travelers } = unpack(data);
  const accent = b.primary_color || '#e89c5f';
  const font = resolveFont(b, 'light');
  return (
    <article className="p-xl bg-white" style={{ fontFamily: font }} data-testid="tpl-light">
      {include.hero && <Hero p={p} b={b} accent={accent} font={font} align="center" adults={adults} children={children} travelers={travelers} />}
      {include.highlights && <Section title="Highlights" accent={accent} font={font}><Paragraph text={b.highlights} font={font} /></Section>}
      {include.itinerary  && <Section title="Itinerary"  accent={accent} font={font}><Itinerary days={days} items={items} accent={accent} font={font} /></Section>}
      {include.hotels     && <Section title="Hotels"     accent={accent} font={font}><Hotels items={items.hotel} accent={accent} font={font} currency={currency} /></Section>}
      {include.costing    && <Section title="Pricing"    accent={accent} font={font}><Costing items={items} total={total} currency={currency} accent={accent} font={font} /></Section>}
      {include.inclusions && <Section title="What's Included" accent={accent} font={font}><Paragraph text={b.inclusions} font={font} /></Section>}
      {include.exclusions && <Section title="What's Excluded" accent={accent} font={font}><Paragraph text={b.exclusions} font={font} /></Section>}
      {include.terms      && <Section title="Payment Terms" accent={accent} font={font}><Paragraph text={b.terms_of_payment} font={font} /></Section>}
      {include.contacts   && <Section title="Get in Touch" accent={accent} font={font}><Contacts b={b} font={font} /></Section>}
      {include.socials    && <Socials b={b} font={font} accent={accent} />}
    </article>
  );
}

const STYLES = { elegant: Elegant, dark: Dark, light: Light };
