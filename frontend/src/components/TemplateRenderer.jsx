import React, { memo, useState, useEffect, Suspense } from 'react';
import { TEMPLATE_REGISTRY } from '../templates/registry.js';
import { formatINR } from '../lib/currency.js';
import { fetchContextualImage } from '../services/imageService.js';
import { incrementAnalytics } from '../services/analyticsService.js';

export const ALL = {
  hero: true, highlights: true, itinerary: true, hotels: true,
  costing: true, inclusions: true, exclusions: true, terms: true, contacts: true, socials: true,
};

export const SECTIONS = ['hero', 'highlights', 'itinerary', 'hotels', 'costing', 'inclusions', 'exclusions', 'terms', 'contacts', 'socials'];

export const THEMES = {
  'modern': { bg: '#ffffff', text: '#000000', accent: '#1a1a1a', alt: '#f9fafb' },
  'minimal': { bg: '#fafafa', text: '#2d3748', accent: '#4a5568', alt: '#edf2f7' },
  'dark': { bg: '#050505', text: '#f9fafb', accent: '#d1d5db', alt: '#111111' },
  'classic': { bg: '#fdfbf7', text: '#1c1917', accent: '#78716c', alt: '#f5f5f4' },
  'tropical': { bg: '#ffffff', text: '#064e3b', accent: '#059669', alt: '#ecfdf5' },
  'corporate': { bg: '#ffffff', text: '#0f172a', accent: '#0284c7', alt: '#f8fafc' },
  'honeymoon': { bg: '#101010', text: '#f8f8f8', accent: '#d4af37', alt: '#1a1a1a' },
  'family': { bg: '#fffdf2', text: '#4a3f35', accent: '#f59e0b', alt: '#fdf6e3' },
  'adventure': { bg: '#f1f5f9', text: '#0f172a', accent: '#ea580c', alt: '#e2e8f0' },
  'beach': { bg: '#f0f9ff', text: '#0c4a6e', accent: '#0284c7', alt: '#e0f2fe' },
  'cruise': { bg: '#f8fafc', text: '#1e293b', accent: '#3b82f6', alt: '#e2e8f0' },
  'wildlife': { bg: '#fefce8', text: '#422006', accent: '#65a30d', alt: '#fef08a' }
};

const ClassicTemplateRenderer = memo(function ClassicTemplateRenderer({ style = 'classic', data, include = ALL, order = SECTIONS, customBlocks = [], viewMode = 'document', activeSlide = 0 }) {
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

  const safeText = (val) => Array.isArray(val) ? val.join('\n') : (val && typeof val === 'object' ? JSON.stringify(val) : (val ?? ''));

  const renderSection = (key, index) => {
    if (!include[key]) return null;
    
    const isActive = viewMode === 'document' || index === activeSlide;
    const displayStyle = isActive ? 'block' : 'none';
    
    // Add page-break CSS classes
    const sectionClass = `editorial-section relative overflow-hidden bg-[${theme.bg}] text-[${theme.text}] ${viewMode === 'document' ? 'py-[8mm] px-[12mm]' : 'p-[14mm]'}`;
    const sectionStyle = { 
      display: displayStyle, 
      breakBefore: 'auto', // Allow natural flow according to page fit
      minHeight: viewMode === 'presentation' ? '100%' : 'auto',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: fontBody
    };

    const Title = ({ children }) => <h2 className="text-4xl mb-6 pb-2 border-b border-opacity-20 uppercase tracking-widest" style={{ fontFamily: fontHeadline, color: theme.accent, borderColor: theme.accent }}>{children}</h2>;

    switch(key) {
      case 'hero':
        const cover = safeText(b.cover_image_url || bgImage);
        const logo = safeText(b.logo_url || '');
        const breakdown = `${travelers} traveller${travelers === 1 ? '' : 's'}` + ((adults || children) ? ` · ${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}` : '');
        const agencyName = safeText(b.agency_name || '');
        
        let heroTitle = safeText(p.name || p.destination || 'Proposal');
        let clientName = safeText(brief.client_name || p.client_name || p.client || brief.customer_name || p.customer_name || '');
        if (heroTitle.includes(' — ')) {
          const parts = heroTitle.split(' — ');
          heroTitle = parts[0].trim();
          if (!clientName && parts[1]) clientName = parts[1].trim();
        } else if (heroTitle.includes(' - ')) {
          const parts = heroTitle.split(' - ');
          heroTitle = parts[0].trim();
          if (!clientName && parts[1]) clientName = parts[1].trim();
        }
        
        return (
          <section key={key} className={sectionClass + " !p-0"} style={{ ...sectionStyle, minHeight: '35vh' }}>
            {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 p-[14mm] text-white flex flex-col justify-between h-full min-h-[35vh]">
              {/* Dedicated Top Header Bar so logo and text never coincide */}
              <div className="flex items-center justify-between gap-4 mb-12">
                {logo ? (
                  <img src={logo} alt="Agency logo" className="h-16 max-w-[220px] object-contain bg-white/95 rounded-lg p-2.5 shadow-xl shrink-0" />
                ) : (
                  agencyName ? (
                    <span className="tracking-[0.3em] uppercase text-sm font-semibold text-white/95 drop-shadow-md" style={{ fontFamily: fontSubhead }}>
                      {agencyName}
                    </span>
                  ) : <span />
                )}
              </div>
              
              {/* Bottom Content for Title & Breakdown */}
              <div className="mt-auto">
                {logo && agencyName ? (
                  <p className="tracking-[0.3em] uppercase mb-3 text-sm text-white/80 drop-shadow" style={{ fontFamily: fontSubhead }}>
                    {agencyName}
                  </p>
                ) : null}
                <h1 className="text-6xl md:text-8xl leading-none mb-3 font-medium drop-shadow-lg" style={{ fontFamily: fontHeadline }}>
                  {heroTitle}
                </h1>
                {clientName ? (
                  <p className="text-2xl md:text-3xl text-white/95 font-light italic mb-5 tracking-wide drop-shadow" style={{ fontFamily: fontSubhead }}>
                    Curated For {clientName}
                  </p>
                ) : null}
                <p className="text-xl md:text-2xl max-w-2xl text-white/90 font-light drop-shadow" style={{ fontFamily: fontSubhead }}>
                  {safeText(p.destination || '')}{p.destination && breakdown ? ' · ' : ''}{breakdown}
                </p>
              </div>
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
        
        const allItems = Object.values(items).flat();

        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Daily Itinerary</Title>
            <ol className="space-y-8">
              {list.map((d, i) => {
                const dayNum = d.day || i + 1;
                const dayItems = allItems.filter(it => it.meta?.day === dayNum);
                const contentBlocks = Array.isArray(d.content) ? d.content : [];
                
                // Track item IDs or names already rendered in content blocks so we don't duplicate
                const renderedNames = new Set(contentBlocks.map(b => (b.data?.name || '').toLowerCase().trim()));

                return (
                <li key={i} className="flex flex-col md:flex-row gap-6 break-inside-avoid p-6 rounded-2xl mb-8 shadow-sm" style={{ backgroundColor: theme.alt }}>
                  <span className="flex-shrink-0 w-24 text-2xl font-bold" style={{ color: theme.accent, fontFamily: fontSubhead }}>Day {String(dayNum).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl mb-3 font-bold" style={{ fontFamily: fontSubhead }}>{d.title || d.label || 'Free time'}</h3>
                    {d.description && typeof d.description === 'string' && contentBlocks.length === 0 && (
                      <p className="text-base opacity-80 whitespace-pre-wrap mb-4 leading-relaxed" style={{ fontFamily: fontBody }}>{d.description}</p>
                    )}
                    
                    {/* Render Rich Content Blocks */}
                    {contentBlocks.length > 0 && (
                      <div className="space-y-4 my-4">
                        {contentBlocks.map(block => {
                          if (block.type === 'heading') {
                            return <h4 key={block.id} className="text-xl font-bold pt-2" style={{ fontFamily: fontSubhead }}>{block.data.text}</h4>;
                          }
                          if (block.type === 'text') {
                            return <p key={block.id} className="text-base opacity-80 whitespace-pre-wrap leading-relaxed" style={{ fontFamily: fontBody }}>{block.data.text}</p>;
                          }
                          if (block.type === 'image' && block.data.url) {
                            return (
                              <div key={block.id} className="rounded-xl overflow-hidden my-3 shadow-sm border border-opacity-10 max-h-80" style={{ borderColor: theme.text }}>
                                <img src={block.data.url} alt="" className="w-full h-full object-cover" />
                              </div>
                            );
                          }
                          if (block.type === 'gallery' && block.data.urls) {
                            const urls = block.data.urls.split('\n').map(u => u.trim()).filter(Boolean);
                            if (urls.length === 0) return null;
                            return (
                              <div key={block.id} className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
                                {urls.map((u, idx) => (
                                  <div key={idx} className="aspect-[4/3] rounded-lg overflow-hidden shadow-xs">
                                    <img src={u} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          if (['hotel', 'activity', 'flight', 'transfer', 'meals', 'custom'].includes(block.type)) {
                            return (
                              <div key={block.id} className="flex items-stretch gap-4 p-4 rounded-xl my-3 break-inside-avoid page-break-inside-avoid shadow-xs border border-opacity-15" style={{ backgroundColor: theme.bg, borderColor: theme.text }}>
                                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: theme.alt, color: theme.accent }}>
                                      {block.type}
                                    </span>
                                  </div>
                                  <h4 className="text-lg font-bold mb-1" style={{ fontFamily: fontSubhead }}>{block.data.name || 'Untitled element'}</h4>
                                  {block.data.details && <p className="text-sm opacity-80" style={{ fontFamily: fontBody }}>{block.data.details}</p>}
                                </div>
                                {block.data.image_url && (
                                  <div className="w-24 md:w-32 flex-shrink-0 rounded-lg overflow-hidden border border-opacity-20 flex" style={{ borderColor: theme.text }}>
                                    <img src={block.data.image_url} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}

                    {/* Render Any Attached Inventory Items Not Already Shown In Blocks */}
                    {dayItems.filter(it => !renderedNames.has((it.label || '').toLowerCase().trim())).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-opacity-20 space-y-3" style={{ borderColor: theme.text }}>
                        <div className="text-xs uppercase tracking-wider font-bold opacity-60">Attached Reservations & Services</div>
                        {dayItems.filter(it => !renderedNames.has((it.label || '').toLowerCase().trim())).map(item => {
                          const imgUrl = item.meta?.image_url || (item.meta?.selected_images && item.meta.selected_images[0]) || '';
                          const priceStr = (Number(item.qty) || 0) * (Number(item.unit_price) || 0) > 0 ? formatINR((Number(item.qty) || 0) * (Number(item.unit_price) || 0)) : '';
                          return (
                            <div key={item.id} className="flex items-stretch gap-4 p-3 rounded-xl break-inside-avoid page-break-inside-avoid shadow-xs border border-opacity-15" style={{ backgroundColor: theme.bg, borderColor: theme.text }}>
                              <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.alt, color: theme.accent }}>
                                    {item.kind}
                                  </span>
                                </div>
                                <h4 className="text-base font-bold" style={{ fontFamily: fontSubhead }}>{item.label}</h4>
                                {priceStr && <p className="text-xs font-semibold mt-1" style={{ color: theme.accent }}>{priceStr}</p>}
                              </div>
                              {imgUrl && (
                                <div className="w-20 md:w-28 flex-shrink-0 rounded-md overflow-hidden border border-opacity-20 flex" style={{ borderColor: theme.text }}>
                                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              )})}
            </ol>
          </section>
        );

      case 'hotels':
        if (!items.hotel?.length) return null;
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Luxury Accommodation</Title>
            <ul className="space-y-8">
              {items.hotel.map((it) => {
                const imgUrl = it.meta?.image_url || (it.meta?.selected_images && it.meta.selected_images[0]) || '';
                const priceStr = formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0));
                return (
                <li key={it.id} className="flex items-stretch gap-6 pb-6 break-inside-avoid page-break-inside-avoid border-b border-opacity-10" style={{ borderColor: theme.text }}>
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded w-max mb-2" style={{ backgroundColor: theme.alt, color: theme.accent }}>Hotel Reservation</span>
                    <span className="text-2xl font-bold mb-1" style={{ fontFamily: fontSubhead }}>{it.label}</span>
                    {it.meta?.details && <p className="text-sm opacity-80 mb-2" style={{ fontFamily: fontBody }}>{it.meta.details}</p>}
                    <span className="text-lg font-bold mt-auto" style={{ color: theme.accent }}>{priceStr}</span>
                  </div>
                  {imgUrl && (
                    <div className="w-32 md:w-48 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-opacity-20 flex" style={{ borderColor: theme.text }}>
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </li>
              )})}
            </ul>
          </section>
        );

      case 'costing':
        const groups = Object.entries(items);
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Budget</Title>
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
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>What's Included</Title><div className="whitespace-pre-wrap">{safeText(b.inclusions) || '—'}</div></section>;
      case 'exclusions':
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>What's Excluded</Title><div className="whitespace-pre-wrap">{safeText(b.exclusions) || '—'}</div></section>;
      case 'terms':
        return <section key={key} className={sectionClass} style={sectionStyle}><Title>Terms of Payment</Title><div className="whitespace-pre-wrap">{safeText(b.terms_of_payment) || '—'}</div></section>;
      
      case 'contacts':
        return (
          <section key={key} className={sectionClass} style={sectionStyle}>
            <Title>Contact</Title>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-lg">
              {b.contact_email && <div className="break-inside-avoid"><span className="opacity-60 flex items-center gap-2 text-sm mb-1 uppercase tracking-widest"><span className="material-symbols-outlined text-[18px]">mail</span>Email</span><a href={`mailto:${safeText(b.contact_email)}`} className="underline hover:opacity-80 font-medium" style={{ color: theme.text }}>{safeText(b.contact_email)}</a></div>}
              {b.contact_phone && <div className="break-inside-avoid"><span className="opacity-60 flex items-center gap-2 text-sm mb-1 uppercase tracking-widest"><span className="material-symbols-outlined text-[18px]">call</span>Phone</span><a href={`tel:${safeText(b.contact_phone).replace(/[^0-9+]/g, '')}`} className="underline hover:opacity-80 font-medium" style={{ color: theme.text }}>{safeText(b.contact_phone)}</a></div>}
              {b.website       && <div className="break-inside-avoid"><span className="opacity-60 flex items-center gap-2 text-sm mb-1 uppercase tracking-widest"><span className="material-symbols-outlined text-[18px]">language</span>Website</span><a href={safeText(b.website).startsWith('http') ? safeText(b.website) : `https://${safeText(b.website)}`} target="_blank" rel="noreferrer" className="underline hover:opacity-80 font-medium" style={{ color: theme.text }}>{safeText(b.website)}</a></div>}
              {b.address       && <div className="md:col-span-2 break-inside-avoid"><span className="opacity-60 flex items-center gap-2 text-sm mb-1 uppercase tracking-widest"><span className="material-symbols-outlined text-[18px]">location_on</span>Address</span>{safeText(b.address)}</div>}
            </div>
          </section>
        );
      
      case 'socials':
        const links = [
          ['Facebook', b.social_facebook, 'share'], 
          ['Instagram', b.social_instagram, 'photo_camera'], 
          ['LinkedIn', b.social_linkedin, 'work']
        ].filter(([, v]) => v);
        if (!links.length) return null;
        return (
          <section key={key} className={sectionClass + " border-t mt-12 pt-8"} style={sectionStyle}>
            <div className="flex justify-center gap-8">
              {links.map(([name, url, icon]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline opacity-80 hover:opacity-100 font-medium" style={{ color: theme.accent }}>
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  {name}
                </a>
              ))}
            </div>
          </section>
        );

      default:
        const cb = customBlocks.find(c => c.id === key);
        if (cb) {
          const contentVal = safeText(b[key] || cb.content || '');
          return (
            <section key={key} className={sectionClass} style={sectionStyle}>
              <Title>{cb.label}</Title>
              {cb.type === 'text' ? (
                 <div className="whitespace-pre-wrap">{contentVal || '—'}</div>
              ) : cb.type === 'list' ? (
                 <ul className="list-disc pl-6 space-y-2 text-lg mt-4">
                   {(Array.isArray(b[key] || cb.content) ? (b[key] || cb.content) : contentVal.split('\n')).map((item, i) => item.trim() && <li key={i}>{item}</li>)}
                 </ul>
              ) : (
                 contentVal ? <img src={contentVal} className="w-full max-h-[600px] object-cover rounded-xl mt-4 shadow-lg break-inside-avoid" alt={cb.label} /> : null
              )}
            </section>
          );
        }
        return null;
    }
  };

  const activeKeys = order.filter(key => include[key]);

  return (
    <article className="proposal-document min-h-full w-full" style={{ backgroundColor: theme.bg }}>
      {activeKeys.map((key, idx) => renderSection(key, idx))}
      
      {/* Custom Branding Fields Accreditations & Badges */}
      {branding?.custom_fields && branding.custom_fields.length > 0 && (
        <div className="editorial-section break-inside-avoid page-break-inside-avoid px-[14mm] py-6 my-6 text-center border-y" style={{ borderColor: theme.accent + '20', backgroundColor: theme.alt + '80' }}>
          <div className="flex flex-wrap items-center justify-center gap-6 max-w-4xl mx-auto">
            {branding.custom_fields.map((cf, idx) => cf.label && (
              <div key={cf.id || idx} className="flex flex-col items-center px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-60" style={{ color: theme.text, fontFamily: fontSubhead }}>{cf.label}</span>
                <span className="text-sm font-semibold mt-0.5" style={{ color: theme.accent, fontFamily: fontBody }}>{cf.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Luxury Action Footer for WhatsApp Approval & Modifications */}
      {(viewMode === 'document' || viewMode === 'presentation' || true) && (
        <div className="editorial-section break-inside-avoid page-break-inside-avoid p-[14mm] mt-8 text-center" style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: fontBody }}>
          <div className="max-w-2xl mx-auto p-8 rounded-3xl border shadow-sm" style={{ backgroundColor: theme.alt, borderColor: theme.accent + '40' }}>
            <h3 className="text-3xl mb-3 uppercase tracking-widest font-semibold" style={{ fontFamily: fontHeadline, color: theme.accent }}>
              Ready to Begin Your Journey?
            </h3>
            <p className="text-base opacity-80 max-w-xl mx-auto mb-8 font-light leading-relaxed" style={{ fontFamily: fontSubhead }}>
              We are dedicated to crafting an immaculate travel experience. Connect with your dedicated curator instantly via WhatsApp to finalize your booking or refine any details.
            </p>
            {(() => {
              const originUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:3000';
              const cleanPhone = (b.contact_phone || '+919876543210').replace(/[^0-9]/g, '');
              const pid = p?.id || p?.proposal_id || '';
              const cname = p?.client_name || p?.client || 'Client';
              const dest = p?.destination || 'Trip';
              const pname = p?.name || 'Custom Plan';
              const approveUrl = `${originUrl}/proposal-action?type=approval&id=${pid}&client=${encodeURIComponent(cname)}&dest=${encodeURIComponent(dest)}&phone=${cleanPhone}&name=${encodeURIComponent(pname)}`;
              const modifyUrl = `${originUrl}/proposal-action?type=modification&id=${pid}&client=${encodeURIComponent(cname)}&dest=${encodeURIComponent(dest)}&phone=${cleanPhone}&name=${encodeURIComponent(pname)}`;
              return (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    onClick={() => incrementAnalytics('approval', pid, dest, cname)}
                    href={approveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium tracking-wider uppercase text-sm shadow-md transition-all flex items-center justify-center gap-3 no-underline hover:opacity-95 cursor-pointer"
                    style={{ backgroundColor: '#10b981', color: '#ffffff' }}
                  >
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Approve Proposal
                  </a>
                  <a
                    onClick={() => incrementAnalytics('modification', pid, dest, cname)}
                    href={modifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium tracking-wider uppercase text-sm shadow-sm transition-all flex items-center justify-center gap-3 no-underline border hover:opacity-95 cursor-pointer"
                    style={{ backgroundColor: theme.bg, color: theme.text, borderColor: theme.accent }}
                  >
                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    Request Modifications
                  </a>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </article>
  );
});
const TemplateRenderer = memo(function TemplateRenderer(props) {
  const { style = 'classic' } = props;
  const registryEntry = TEMPLATE_REGISTRY[style];
  
  if (registryEntry && registryEntry.component) {
    const RegistryComponent = registryEntry.component;
    return (
      <Suspense fallback={<div className="p-12 text-center text-on-surface-variant font-body-md animate-pulse">Loading {registryEntry.name} layout...</div>}>
        <RegistryComponent {...props} />
      </Suspense>
    );
  }
  
  return <ClassicTemplateRenderer {...props} />;
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
