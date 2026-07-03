import React, { useState, useEffect } from 'react';
import './themes.css';
import { formatPrice, safeText, SectionHeader, PageBreak } from '../base/BaseTemplate.jsx';
import { fetchContextualImage } from '../../services/imageService.js';
import { incrementAnalytics } from '../../services/analyticsService.js';

export default function LuxuryThemeEngine({ themeSlug, config, data, include = {} }) {
  if (!data) return null;

  const p = data.proposal || {};
  const b = p.preferences?.branding || {};
  const items = data.items_by_kind || {};
  const total = data.totals?.subtotal || 0;
  const currency = data.totals?.currency || 'INR';
  const days = Array.isArray(p.itinerary?.days) ? p.itinerary.days : [];
  const brief = p.brief || {};
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

  return (
    <div className="theme-host min-h-screen" style={{ backgroundColor: bgColor, fontFamily }}>
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
              {safeText(p.name || p.destination || 'Bespoke Journey')}
            </h1>
            <p className="text-lg text-white/90 max-w-2xl font-light leading-relaxed drop-shadow">
              {safeText(brief.special_notes || p.highlights || config.defaultWelcome || 'An extraordinary travel experience meticulously designed to elevate every moment.')}
            </p>
          </div>

          <div className="flex flex-wrap justify-between items-end border-t border-white/20 pt-6 text-white/90 text-sm">
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Destination</span>
              <strong className="text-base text-white">{safeText(p.destination || 'Global')}</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Duration</span>
              <strong className="text-base text-white">{days.length || p.duration_days || 7} Days & Nights</strong>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-white/60 block">Party Size</span>
              <strong className="text-base text-white">{travelers} VIP Traveller{travelers === 1 ? '' : 's'}</strong>
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
                    <span className="font-bold text-sm" style={{ color: accentColor }}>{formatPrice(hotel.unit_price || 0, currency)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Costing & Investment ───────────────────────────────────────────── */}
      {(include.costing ?? true) && total > 0 && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto">
            <SectionHeader title="Investment Overview" subtitle="Bespoke Pricing & Details" accentColor={primaryColor} />
            <div className="theme-card overflow-hidden p-0 border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-widest text-white font-bold" style={{ backgroundColor: primaryColor }}>
                    <th className="py-4 px-6">Category</th>
                    <th className="py-4 px-6">Description</th>
                    <th className="py-4 px-6 text-center">Qty</th>
                    <th className="py-4 px-6 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {Object.entries(items).map(([kind, list]) => 
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
                    <td colSpan={3} className="py-5 px-6 text-right uppercase tracking-widest text-xs" style={{ color: primaryColor }}>Total Investment</td>
                    <td className="py-5 px-6 text-right text-xl font-black" style={{ color: primaryColor, fontFamily: headlineFont }}>{formatPrice(total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─── Inclusions & Exclusions ────────────────────────────────────────── */}
      {((include.inclusions ?? true) || (include.exclusions ?? true)) && (
        <section className="theme-section bg-slate-50/50">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {(include.inclusions ?? true) && (
              <div className="theme-card border-t-4" style={{ borderTopColor: primaryColor }}>
                <h3 className="text-lg font-bold mb-4 uppercase tracking-wider flex items-center gap-2" style={{ color: primaryColor }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: primaryColor }}>check_circle</span>
                  What Is Included
                </h3>
                <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed pl-2">
                  {safeText(p.inclusions || '• VIP Airport Transfers\n• Luxury Accommodations\n• Daily Gourmet Breakfast\n• Private Guided Tours\n• All Local Taxes & Fees')}
                </div>
              </div>
            )}
            {(include.exclusions ?? true) && (
              <div className="theme-card border-t-4 border-rose-500">
                <h3 className="text-lg font-bold mb-4 uppercase tracking-wider flex items-center gap-2 text-rose-600">
                  <span className="material-symbols-outlined text-[20px] text-rose-500">cancel</span>
                  What Is Not Included
                </h3>
                <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed pl-2">
                  {safeText(p.exclusions || '• International Airfare\n• Personal Travel Insurance\n• Gratuities & Tips\n• Personal Expenses')}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Terms & Conditions ─────────────────────────────────────────────── */}
      {(include.terms ?? true) && (
        <section className="theme-section">
          <div className="max-w-4xl mx-auto theme-card">
            <h3 className="text-lg font-bold mb-3 uppercase tracking-widest text-slate-400">Terms & Policy</h3>
            <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed m-0 font-light">
              {safeText(p.terms || 'Rates are guaranteed upon receipt of deposit. Cancellations must be made in writing 30 days prior to departure. Standard agency booking terms apply.')}
            </p>
          </div>
        </section>
      )}

      {/* ─── Interactive WhatsApp Approval & Modification Footer ────────────── */}
      <section className="theme-section text-center p-[14mm]">
        <div className="max-w-2xl mx-auto p-8 rounded-3xl border shadow-lg relative overflow-hidden" style={{ backgroundColor: '#f8fafc', borderColor: accentColor + '40' }}>
          <h3 className="text-3xl mb-3 uppercase tracking-widest font-semibold" style={{ fontFamily: headlineFont, color: primaryColor }}>
            Ready to Begin Your Journey?
          </h3>
          <p className="text-base text-slate-600 max-w-xl mx-auto mb-8 font-light leading-relaxed">
            Connect with your dedicated travel curator instantly via WhatsApp to approve this proposal or request customized adjustments.
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
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-base no-underline"
                >
                  <span className="material-symbols-outlined text-[20px]">check_circle</span> Approve Proposal via WhatsApp
                </a>
                <a
                  onClick={() => incrementAnalytics('modification', pid, dest, cname)}
                  href={modifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 bg-white text-slate-800 font-bold rounded-2xl border border-slate-300 shadow hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-base no-underline"
                >
                  <span className="material-symbols-outlined text-[20px]">edit_note</span> Request Modifications
                </a>
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
