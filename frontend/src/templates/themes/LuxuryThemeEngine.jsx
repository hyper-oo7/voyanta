import React, { useState, useEffect } from 'react';
import './themes.css';
import { formatPrice, safeText, SectionHeader, PageBreak } from '../base/BaseTemplate.jsx';
import { fetchContextualImage } from '../../services/imageService.js';
import { incrementAnalytics } from '../../services/analyticsService.js';
import UniversalTemplateExtras from '../../components/common/UniversalTemplateExtras.jsx';

export default function LuxuryThemeEngine(props) {
  const { themeSlug, config, data, include = {}, customBlocks = [], order = [] } = props;
  if (!data) return null;

  const p = data.proposal || {};
  const b = p.preferences?.branding || {};
  const items = data.items_by_kind || {};
  const total = data.totals?.subtotal || 0;
  const currency = data.totals?.currency || 'INR';
  const days = Array.isArray(p.itinerary?.days) ? p.itinerary.days : (Array.isArray(p.itinerary) ? p.itinerary : (Array.isArray(p.days) ? p.days : []));
  const brief = p.brief || {};
  const visibilityMode = (p.visibility_mode || data.visibility_mode || 'ITEMIZED').toUpperCase();
  const travelers = Number(brief.num_adults ?? p.travelers ?? 1) + Number(brief.num_children ?? 0) || Number(p.travelers) || 1;

  // Resolve customized colors or fall back to theme defaults
  const primaryColor = b.primary_color || config.primaryColor || '#0f172a';
  const accentColor = b.secondary_color || config.accentColor || '#3b82f6';
  const bgColor = b.bg_color || config.bgColor || '#ffffff';
  const fontFamily = config.fontFamily || 'Outfit, sans-serif';
  const headlineFont = config.headlineFont || 'Playfair Display, serif';

  const [bgImage, setBgImage] = useState('');
  const [dayImages, setDayImages] = useState({});

  useEffect(() => {
    const dest = p.destination || 'Luxury Destination';
    const type = p.preferences?.tour_type || config.defaultTourType || 'luxury';
    fetchContextualImage(dest, type).then(setBgImage);

    if (days.length > 0) {
      days.forEach((day, idx) => {
        const query = `${day.title || dest} ${config.imageKeyword || 'travel landscape'}`;
        fetchContextualImage(query, 'scenic').then(url => {
          setDayImages(prev => ({ ...prev, [idx]: url }));
        });
      });
    }
  }, [p.destination, p.preferences?.tour_type, days.length, config.defaultTourType, config.imageKeyword]);

  const coverUrl = safeText(b.cover_image_url || bgImage || config.defaultCover);
  const logoUrl = safeText(b.logo_url || '');
  const agencyName = safeText(b.agency_name || 'Voyanta Luxury Travel');
  const clientName = safeText(brief.client_name || p.client_name || 'Valued Client');
  const rawTitle = safeText(p.name || p.destination || 'Bespoke Journey')
    .replace(new RegExp(`\\s*[—\\-]\\s*${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .replace(new RegExp(`\\s*[—\\-]\\s*${(p.client_name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .trim();

  const startDate = brief.start_date || p.start_date;
  const endDate = brief.end_date || p.end_date;
  const dateRangeStr = (startDate && endDate) 
    ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : (startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible / Open Dates');

  const adultsNum = brief.num_adults ?? brief.adults ?? p.adults ?? travelers;
  const childrenNum = brief.num_children ?? brief.children ?? p.children ?? 0;
  const partySizeStr = childrenNum > 0 ? `${travelers} Persons (${adultsNum} Adults, ${childrenNum} Children)` : `${travelers} Person${travelers === 1 ? '' : 's'}`;

  return (
    <div className="theme-host min-h-screen relative overflow-hidden" style={{ backgroundColor: bgColor, fontFamily }}>
      {/* ─── Document Watermark ─────────────────────────────────────────────── */}
      {((b.watermark_targets || ['invoice', 'receipt', 'proposal']).includes('proposal')) && b.watermark_text && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.04] print:opacity-[0.06]">
          <span className="text-7xl md:text-9xl font-black uppercase tracking-widest text-slate-900 -rotate-45 select-none whitespace-nowrap">
            {b.watermark_text}
          </span>
        </div>
      )}
      {/* ─── Hero Cover Section ─────────────────────────────────────────────── */}
      {(include.hero ?? true) && (
        <section className="theme-cover" style={{ backgroundImage: `url("${coverUrl}")` }}>
          <div className="flex justify-between items-start w-full">
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt={agencyName} className="h-14 w-auto object-contain brightness-200" />
              ) : (
                <span className="text-2xl font-black tracking-widest uppercase text-white drop-shadow-md" style={{ fontFamily: headlineFont }}>
                  {agencyName}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white backdrop-blur-md shadow-lg border border-white/20" style={{ backgroundColor: primaryColor }}>
                {config.badgeText || 'Curated Itinerary'}
              </span>
              <p className="text-xs tracking-widest uppercase text-white/80 m-0 mt-2">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="my-auto py-12">
            <span className="text-sm uppercase tracking-[0.3em] font-bold block mb-4" style={{ color: accentColor }}>
              {config.subtitlePrefix || 'Prepared Exclusively For'} {clientName}
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 drop-shadow-xl max-w-4xl" style={{ fontFamily: headlineFont }}>
              {rawTitle || 'Bespoke Journey'}
            </h1>
            <p className="text-lg text-white/90 max-w-2xl font-light leading-relaxed drop-shadow">
              {safeText(brief.special_notes || p.highlights || config.defaultWelcome || 'An extraordinary travel experience meticulously designed to elevate every moment.')}
            </p>
          </div>

          <div className="flex flex-wrap justify-between items-end border-t border-white/20 pt-6 text-white/90 text-sm gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Destination</span>
              <strong className="text-base text-white">{safeText(p.destination || 'Global')}</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Travel Dates</span>
              <strong className="text-base text-white">{dateRangeStr}</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Duration</span>
              <strong className="text-base text-white">{days.length || p.duration_days || 7} Days & Nights</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">No. of Persons</span>
              <strong className="text-base text-white">{partySizeStr}</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Investment</span>
              <strong className="text-base font-bold" style={{ color: accentColor }}>{formatPrice(total, currency)}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ─── Highlights & Executive Summary ─────────────────────────────────── */}
      {(include.highlights ?? true) && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto">
            <SectionHeader title={config.highlightsTitle || 'Journey Overview'} subtitle="Executive Summary" accentColor={primaryColor} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-2xl font-bold leading-snug" style={{ color: primaryColor, fontFamily: headlineFont }}>
                  {safeText(p.name || 'Your Bespoke Expedition')}
                </h3>
                <p className="text-slate-600 leading-relaxed text-base font-light">
                  {safeText(p.highlights || brief.special_notes || 'We have curated a seamless journey combining authentic local discoveries with world-class comfort. From private transfers to handpicked accommodations, every detail has been refined.')}
                </p>
              </div>
              <div className="theme-card bg-slate-50 border-l-4" style={{ borderLeftColor: accentColor }}>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-3">Key Highlights</span>
                <ul className="space-y-2 text-sm font-medium text-slate-700 m-0 pl-4 list-disc marker:text-primary">
                  <li>VIP Airport Greeting & Transfers</li>
                  <li>Luxury 5-Star Accommodations</li>
                  <li>Curated Private Experiences</li>
                  <li>24/7 Dedicated Concierge</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Day-by-Day Itinerary Spreads ───────────────────────────────────── */}
      {(include.itinerary ?? true) && days.length > 0 && (
        <section className="theme-section">
          <SectionHeader title="Daily Chronicle" subtitle="Day by Day Itinerary" accentColor={primaryColor} />
          <div className="space-y-12 max-w-5xl mx-auto">
            {days.map((day, idx) => {
              const imgUrl = dayImages[idx] || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80';
              const isEven = idx % 2 === 1;

              return (
                <div key={idx} className={`flex flex-col md:flex-row gap-8 items-center ${isEven ? 'md:flex-row-reverse' : ''}`}>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ backgroundColor: primaryColor }}>
                        D{day.day || idx + 1}
                      </span>
                      <h3 className="text-2xl font-bold m-0" style={{ color: primaryColor, fontFamily: headlineFont }}>
                        {safeText(day.title || `Day ${idx + 1}`)}
                      </h3>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-sm m-0 pl-13">
                      {safeText(day.description || 'Spend the day exploring iconic landmarks and savoring the local atmosphere at your leisure.')}
                    </p>
                    {Array.isArray(day.activities) && day.activities.length > 0 && (
                      <div className="ml-13 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700">
                        <strong className="uppercase tracking-wider block mb-1" style={{ color: accentColor }}>Featured Experience:</strong>
                        {day.activities.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-5/12 h-64 rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative group">
                    <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Day {day.day || idx + 1} View
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Selected Accommodations ────────────────────────────────────────── */}
      {(include.hotels ?? true) && (items.hotel || []).length > 0 && (
        <section className="theme-section bg-slate-50/50">
          <SectionHeader title="Sanctuaries" subtitle="Selected Accommodations" accentColor={primaryColor} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {(items.hotel || []).map((hotel, i) => (
              <div key={i} className="theme-card overflow-hidden flex flex-col justify-between p-0">
                <div className="h-48 bg-slate-100 relative">
                  <img src={hotel.meta?.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'} alt="" className="w-full h-full object-cover" />
                  <span className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow" style={{ color: primaryColor }}>
                    5 &starf; Luxury
                  </span>
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-lg m-0 mb-1" style={{ color: primaryColor, fontFamily: headlineFont }}>{hotel.label}</h4>
                  <p className="text-xs text-slate-500 m-0 mb-4">{hotel.meta?.location || p.destination || 'Prime City Location'}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <span>{hotel.qty || 1} Night(s) Included</span>
                    {visibilityMode === 'ITEMIZED' && <span className="font-bold text-sm" style={{ color: accentColor }}>{formatPrice(hotel.unit_price || 0, currency)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Costing & Investment ───────────────────────────────────────────── */}
      {(include.costing ?? true) && total > 0 && visibilityMode !== 'HIDDEN' && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto">
            <SectionHeader title="Investment Overview" subtitle="Bespoke Pricing & Details" accentColor={primaryColor} />
            <div className="theme-card overflow-hidden p-0 border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-widest text-white font-bold" style={{ backgroundColor: primaryColor }}>
                    <th className="py-4 px-6">Category</th>
                    {visibilityMode === 'ITEMIZED' && (
                      <>
                        <th className="py-4 px-6">Description</th>
                        <th className="py-4 px-6 text-center">Qty</th>
                      </>
                    )}
                    <th className="py-4 px-6 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibilityMode === 'ITEMIZED' && Object.entries(items).map(([kind, list]) => 
                    list.map((item, i) => (
                      <tr key={`${kind}-${i}`} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-bold uppercase tracking-wider text-xs" style={{ color: accentColor }}>{kind}</td>
                        <td className="py-4 px-6 font-medium text-slate-800">{item.label}</td>
                        <td className="py-4 px-6 text-center text-slate-500">{item.qty || 1}</td>
                        <td className="py-4 px-6 text-right font-bold text-slate-900">{formatPrice((item.qty || 1) * (item.unit_price || 0), currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td colSpan={visibilityMode === 'ITEMIZED' ? 3 : 1} className="py-5 px-6 text-right uppercase tracking-widest text-xs" style={{ color: primaryColor }}>Total Investment</td>
                    <td className="py-5 px-6 text-right text-xl font-black" style={{ color: primaryColor, fontFamily: headlineFont }}>{formatPrice(total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─── Inclusions & Exclusions ────────────────────────────────────────── */}
      {(((include.inclusions ?? true) && (p.inclusions || p.included_items)) || ((include.exclusions ?? true) && (p.exclusions || p.excluded_items))) && (
        <section className="theme-section bg-slate-50/50">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {(include.inclusions ?? true) && (p.inclusions || p.included_items) && (
              <div className="theme-card border-t-4" style={{ borderTopColor: primaryColor }}>
                <h3 className="text-lg font-bold mb-4 uppercase tracking-wider flex items-center gap-2" style={{ color: primaryColor }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: primaryColor }}>check_circle</span>
                  What Is Included
                </h3>
                <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed pl-2">
                  {safeText(p.inclusions || p.included_items)}
                </div>
              </div>
            )}
            {(include.exclusions ?? true) && (p.exclusions || p.excluded_items) && (
              <div className="theme-card border-t-4 border-rose-500">
                <h3 className="text-lg font-bold mb-4 uppercase tracking-wider flex items-center gap-2 text-rose-600">
                  <span className="material-symbols-outlined text-[20px] text-rose-500">cancel</span>
                  What Is Not Included
                </h3>
                <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed pl-2">
                  {safeText(p.exclusions || p.excluded_items)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── What to Pack & Trip Essentials ─────────────────────────────────── */}
      {include?.what_to_pack !== false && include?.packing_list !== false && (p.what_to_pack || b.what_to_pack) && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto theme-card border-l-4" style={{ borderLeftColor: primaryColor }}>
            <h3 className="text-lg font-bold mb-4 uppercase tracking-wider flex items-center gap-2" style={{ color: primaryColor }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: primaryColor }}>backpack</span>
              Packing & Trip Essentials
            </h3>
            <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed pl-2 font-medium">
              {safeText(p.what_to_pack || b.what_to_pack)}
            </div>
          </div>
        </section>
      )}

      {/* ─── Terms & Conditions ─────────────────────────────────────────────── */}
      {(include.terms ?? true) && (p.terms || b.terms_conditions) && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto theme-card">
            <h3 className="text-lg font-bold mb-3 uppercase tracking-widest text-slate-400">Terms & Policy</h3>
            <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed m-0 font-light">
              {safeText(p.terms || b.terms_conditions)}
            </p>
          </div>
        </section>
      )}


      <UniversalTemplateExtras proposal={p} branding={b} customBlocks={customBlocks} order={order} style={themeSlug} theme={{ typography: { headline: headlineFont, body: fontFamily }, colors: { primary: primaryColor, accent: accentColor } }} />

      {/* ─── Legal Footer & Branding ─────────────────────────────────────────── */}
      <footer className="py-8 px-6 mt-12 border-t border-slate-200/80 text-center text-xs text-slate-400 font-mono relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {b.company_legal_name || agencyName || 'Voyanta Concierge Engine'}
          </span>
          {(b.gst_number || b.trade_code) && (
            <span>
              {[b.gst_number ? `GST: ${b.gst_number}` : '', b.trade_code ? `Reg: ${b.trade_code}` : ''].filter(Boolean).join(' • ')}
            </span>
          )}
          <span>Generated via Voyanta Luxury Suite</span>
        </div>
      </footer>
    </div>
  );
}
