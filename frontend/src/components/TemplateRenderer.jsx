import { memo, useState, useEffect } from 'react';
import { formatINR } from '../lib/currency.js';
import { fetchContextualImage } from '../services/imageService.js';

export const ALL = {
  hero: true, highlights: true, itinerary: true, hotels: true,
  costing: true, inclusions: true, exclusions: true, terms: true, contacts: true, socials: true,
};

export const SECTIONS = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

const THEMES = {
  'modern': { bg: '#ffffff', text: '#1a1a1a', accent: '#0f172a', alt: '#f1f5f9' },
  'minimal': { bg: '#fafafa', text: '#2d3748', accent: '#4a5568', alt: '#edf2f7' },
  'dark': { bg: '#121212', text: '#e2e8f0', accent: '#cbd5e1', alt: '#1e293b' },
  'classic': { bg: '#fdfbf7', text: '#2c221a', accent: '#8b7355', alt: '#f5f0e6' },
  'tropical': { bg: '#ffffff', text: '#064e3b', accent: '#059669', alt: '#ecfdf5' },
  'corporate': { bg: '#ffffff', text: '#1e293b', accent: '#0284c7', alt: '#f0f9ff' }
};

const TemplateRenderer = memo(function TemplateRenderer({ style = 'classic', data, include = ALL, order = SECTIONS, customBlocks = [], viewMode = 'document', activeSlide = 0 }) {
  if (!data) return null;
  const theme = THEMES[style] || THEMES.classic;
  
  const [bgImage, setBgImage] = useState('');
  useEffect(() => {
    const dest = data.proposal?.destination || '';
    const type = data.proposal?.preferences?.tour_type || '';
    fetchContextualImage(dest, type).then(setBgImage);
  }, [data.proposal?.destination, data.proposal?.preferences?.tour_type]);

  const p = data.proposal || {};
  const b = (p.preferences && p.preferences.branding) || {};
  const items = data.items_by_kind || {};
  const total = data.totals?.subtotal || 0;
  const currency = data.totals?.currency || 'INR';
  const days = (p.itinerary && Array.isArray(p.itinerary.days)) ? p.itinerary.days : [];
  const brief = p.brief || {};
  const adults = Number(brief.num_adults ?? p.travelers ?? 1) || 0;
  const children = Number(brief.num_children ?? 0) || 0;
  const travelers = adults + children || (Number(p.travelers) || 1);

  // Typography variables to enforce Playfair / Cormorant / Inter hierarchy
  const fontHeadline = '"Playfair Display", serif';
  const fontSubhead = '"Cormorant Garamond", serif';
  const fontBody = '"Inter", sans-serif';

  const renderSection = (key, index) => {
    if (!include[key]) return null;
    
    const isActive = viewMode === 'document' || index === activeSlide;
    const displayStyle = isActive ? 'block' : 'none';
    
    // Add page-break CSS classes
    const sectionClass = `editorial-section relative overflow-hidden bg-[${theme.bg}] text-[${theme.text}] p-[14mm]`;
    const sectionStyle = { 
      display: displayStyle, 
      breakBefore: index === 0 ? 'auto' : 'page', // Force new page for PDF
      minHeight: viewMode === 'presentation' ? '100%' : 'auto',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: fontBody
    };

    const Title = ({ children }) => <h2 className="text-4xl mb-6 pb-2 border-b border-opacity-20 uppercase tracking-widest" style={{ fontFamily: fontHeadline, color: theme.accent, borderColor: theme.accent }}>{children}</h2>;

    switch(key) {
      case 'hero':
        const cover = b.cover_image_url || bgImage;
        const logo = b.logo_url || '';
        const breakdown = `${travelers} traveller${travelers === 1 ? '' : 's'}` + ((adults || children) ? ` · ${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}` : '');
        return (
          <section key={key} className={sectionClass + " !p-0"} style={{ ...sectionStyle, minHeight: '297mm' }}>
            {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-black/40" />
            {logo && <img src={logo} alt="Agency logo" className="absolute top-8 left-8 z-20 h-16 max-w-[200px] object-contain bg-white/90 rounded-md p-3 shadow-xl" />}
            <div className="relative z-10 p-[14mm] text-white flex flex-col h-full justify-end min-h-[297mm]">
              <p className="tracking-[0.3em] uppercase mb-4 text-sm" style={{ fontFamily: fontSubhead }}>{b.agency_name || 'Voyanta'}</p>
              <h1 className="text-6xl md:text-8xl leading-none mb-6" style={{ fontFamily: fontHeadline }}>{p.name || 'Proposal'}</h1>
              <p className="text-xl md:text-2xl max-w-2xl opacity-90" style={{ fontFamily: fontSubhead }}>
                {p.client_name ? `Curated for ${p.client_name}` : ''} · {p.destination || ''} · {breakdown}
              </p>
            </div>
          </section>
        );

      case 'highlights':
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Destination Overview</Title>
            <div className="text-lg leading-relaxed whitespace-pre-wrap" style={{ fontFamily: fontBody }}>{b.highlights || '—'}</div>
          </section>
        );

      case 'itinerary':
        const fallback = (items.activity || []).map((a, i) => ({ day: i + 1, title: a.label }));
        const list = days.length ? days : fallback;
        if (!list.length) return null;
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Daily Itinerary</Title>
            <ol className="space-y-8">
              {list.map((d, i) => (
                <li key={i} className="flex gap-6 break-inside-avoid p-4 rounded-xl" style={{ backgroundColor: theme.alt }}>
                  <span className="flex-shrink-0 w-20 text-2xl" style={{ color: theme.accent, fontFamily: fontSubhead }}>Day {String(d.day || i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-xl mb-2 font-semibold" style={{ fontFamily: fontSubhead }}>{d.title || d.label || 'Free time'}</h3>
                    {d.description && <p className="text-base opacity-80" style={{ fontFamily: fontBody }}>{d.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );

      case 'hotels':
        if (!items.hotel?.length) return null;
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Luxury Accommodation</Title>
            <ul className="space-y-8">
              {items.hotel.map((it) => (
                <li key={it.id} className="flex flex-col gap-4 pb-6 break-inside-avoid border-b border-opacity-10" style={{ borderColor: theme.text }}>
                  <div className="flex items-start justify-between w-full">
                    <span className="text-xl font-semibold" style={{ fontFamily: fontSubhead }}>{it.label}</span>
                    <span className="text-lg font-bold" style={{ color: theme.accent }}>{formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</span>
                  </div>
                  {it.meta?.selected_images && it.meta.selected_images.length > 0 && (
                    <div className="flex gap-4 overflow-hidden">
                      {it.meta.selected_images.map((imgUrl, imgIndex) => (
                        <div key={imgIndex} className="w-1/3 aspect-[4/3] rounded-lg overflow-hidden shadow-md">
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );

      case 'costing':
        const groups = Object.entries(items);
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Investment</Title>
            <div className="space-y-4">
              {groups.map(([kind, list]) => {
                const sub = list.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unit_price)||0), 0);
                return (
                  <div key={kind} className="flex justify-between py-3 border-b border-opacity-10 break-inside-avoid text-lg" style={{ borderColor: theme.text }}>
                    <span className="capitalize">{kind} ({list.length})</span>
                    <span style={{ color: theme.accent, fontFamily: fontSubhead }} className="font-semibold">{formatINR(sub)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-8 text-3xl font-bold" style={{ color: theme.accent, fontFamily: fontHeadline }}>
                <span>Total</span><span>{formatINR(total)}</span>
              </div>
            </div>
          </section>
        );

      case 'inclusions':
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>What's Included</Title><div className="whitespace-pre-wrap">{b.inclusions || '—'}</div></section>;
      case 'exclusions':
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>What's Excluded</Title><div className="whitespace-pre-wrap">{b.exclusions || '—'}</div></section>;
      case 'terms':
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>Terms of Payment</Title><div className="whitespace-pre-wrap">{b.terms_of_payment || '—'}</div></section>;
      
      case 'contacts':
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Contact</Title>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-lg">
              {b.contact_email && <div className="break-inside-avoid"><span className="opacity-60 block text-sm mb-1 uppercase tracking-widest">Email</span>{b.contact_email}</div>}
              {b.contact_phone && <div className="break-inside-avoid"><span className="opacity-60 block text-sm mb-1 uppercase tracking-widest">Phone</span>{b.contact_phone}</div>}
              {b.website       && <div className="break-inside-avoid"><span className="opacity-60 block text-sm mb-1 uppercase tracking-widest">Website</span>{b.website}</div>}
              {b.address       && <div className="md:col-span-2 break-inside-avoid"><span className="opacity-60 block text-sm mb-1 uppercase tracking-widest">Address</span>{b.address}</div>}
            </div>
          </section>
        );
      
      case 'socials':
        const links = [['Facebook', b.social_facebook], ['Instagram', b.social_instagram], ['LinkedIn', b.social_linkedin]].filter(([, v]) => v);
        if (!links.length) return null;
        return (
          <section key={key} className={sectionClass + " border-t mt-12 pt-8"} style={sectionStyle}>
            <div className="flex justify-center gap-8">
              {links.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="underline opacity-80 hover:opacity-100" style={{ color: theme.accent }}>{name}</a>)}
            </div>
          </section>
        );

      default:
        const cb = customBlocks.find(c => c.id === key);
        if (cb) {
          return (
            <section key={key} className={sectionClass} style={sectionStyle}>
              <Title>{cb.label}</Title>
              {cb.type === 'text' ? (
                 <div className="whitespace-pre-wrap">{b[key]}</div>
              ) : (
                 b[key] ? <img src={b[key]} className="w-full max-h-[600px] object-cover rounded-xl mt-4 shadow-lg break-inside-avoid" alt={cb.label} /> : null
              )}
            </section>
          );
        }
        return null;
    }
  };

  const activeKeys = order.filter(key => include[key]);

  return (
    <article className="proposal-document" style={{ backgroundColor: theme.bg }}>
      {activeKeys.map((key, idx) => renderSection(key, idx))}
    </article>
  );
});
export default TemplateRenderer;

export function ExportOptionsBar({ value, onChange, order, setOrder, customBlocks = [] }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  const handleDragStart = (e, index) => e.dataTransfer.setData('index', index);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, index) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('index'), 10);
    if (sourceIndex === index) return;
    const newOrder = [...order];
    const [draggedItem] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setOrder(newOrder);
  };
  const getLabel = (s) => customBlocks.find(c => c.id === s)?.label || s;

  return (
    <div className="flex flex-col gap-sm" data-testid="export-options">
      {order.map((s, index) => (
        <div key={s} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)}
          className="flex items-center gap-sm p-sm bg-surface-container-low border border-outline-variant rounded cursor-grab hover:bg-surface-container">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">drag_indicator</span>
          <input type="checkbox" checked={!!value[s]} onChange={() => toggle(s)} className="w-4 h-4 accent-primary" />
          <span className="capitalize font-label-md text-on-surface">{getLabel(s)}</span>
        </div>
      ))}
    </div>
  );
}
