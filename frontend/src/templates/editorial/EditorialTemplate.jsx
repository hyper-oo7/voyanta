import React, { useState, useEffect } from 'react';
import './editorial.css';
import { formatPrice, safeText, SectionHeader, PageBreak } from '../base/BaseTemplate.jsx';
import { fetchContextualImage } from '../../services/imageService.js';
import UniversalTemplateExtras, { DayInventorySections } from '../../components/common/UniversalTemplateExtras.jsx';

export default function EditorialTemplate(props) {
  const { data, include = {}, viewMode = 'document', customBlocks = [], order = [] } = props;
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

  const [bgImage, setBgImage] = useState('');
  const [dayImages, setDayImages] = useState({});

  useEffect(() => {
    const dest = p.destination || 'Japan';
    const type = p.preferences?.tour_type || 'luxury';
    fetchContextualImage(dest, type).then(setBgImage);

    // Pre-fetch images for days
    if (days.length > 0) {
      days.forEach((day, idx) => {
        const query = `${day.title || dest} travel landscape`;
        fetchContextualImage(query, 'scenic').then(url => {
          setDayImages(prev => ({ ...prev, [idx]: url }));
        });
      });
    }
  }, [p.destination, p.preferences?.tour_type, days.length]);

  const coverUrl = safeText(b.cover_image_url || bgImage || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80');
  const logoUrl = safeText(b.logo_url || '');
  const agencyName = safeText(b.agency_name || 'Voyanta Travel');
  const clientName = safeText(brief.client_name || p.client_name || 'Valued Client');
  const rawTitle = safeText(p.name || p.destination || 'Exclusive Journey')
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
    <div className="template-editorial w-full min-h-screen">
      {/* ─── Hero Cover ──────────────────────────────────────────────────────── */}
      {(include.hero ?? true) && (
        <section className="editorial-cover" style={{ backgroundImage: `url("${coverUrl}")` }}>
          <div className="editorial-cover-content flex justify-between items-start w-full">
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt={agencyName} className="h-12 w-auto object-contain brightness-200" />
              ) : (
                <span className="text-xl font-black tracking-widest uppercase">{agencyName}</span>
              )}
            </div>
            <div className="text-right">
              <span className="editorial-badge">Curated Itinerary</span>
              <p className="text-xs tracking-widest uppercase opacity-80 m-0">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="editorial-cover-content my-auto max-w-2xl">
            <h1 className="editorial-title m-0">{rawTitle || 'Exclusive Journey'}</h1>
            <p className="text-xl font-light opacity-90 mt-2 mb-6">
              Tailored specifically for <strong className="font-bold">{clientName}</strong> &middot; {partySizeStr}
            </p>
            <div className="flex flex-wrap gap-6 text-sm font-semibold tracking-wider uppercase border-t border-white/20 pt-6">
              <div>
                <span className="block text-xs opacity-60">Destination</span>
                <span>{safeText(p.destination || 'Various')}</span>
              </div>
              <div>
                <span className="block text-xs opacity-60">Travel Dates</span>
                <span className="normal-case">{dateRangeStr}</span>
              </div>
              <div>
                <span className="block text-xs opacity-60">Duration</span>
                <span>{days.length > 0 ? `${days.length} Days` : 'Custom'}</span>
              </div>
              <div>
                <span className="block text-xs opacity-60">No. of Persons</span>
                <span>{partySizeStr}</span>
              </div>
              {total > 0 && (
                <div>
                  <span className="block text-xs opacity-60">Investment</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="editorial-cover-content flex justify-between items-end text-xs opacity-70 border-t border-white/10 pt-4">
            <span>Powered by Voyanta Concierge</span>
            <span>Ref: {String(p.id || '').slice(0, 8).toUpperCase()}</span>
          </div>
        </section>
      )}

      {/* ─── Highlights / Overview ───────────────────────────────────────────── */}
      {(include.highlights ?? true) && (
        <section className="editorial-page">
          <SectionHeader title="The Experience" subtitle="Journey Overview" accentColor="#e11d48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="col-span-2 text-lg font-light leading-relaxed text-slate-700">
              {safeText(p.brief?.notes || p.trip_details?.overview || `Embark on an unforgettable journey through ${p.destination || 'your destination'}. Every detail has been meticulously curated to balance iconic landmarks with immersive cultural encounters, private luxury transport, and handpicked boutique accommodations.`)}
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Trip Highlights</span>
                <ul className="space-y-2 text-sm font-medium text-slate-700 m-0 pl-4">
                  <li>Private chauffeur & VIP airport transfers</li>
                  <li>Handpicked 5-star luxury accommodations</li>
                  <li>Exclusive guided cultural tours</li>
                  <li>24/7 dedicated concierge assistance</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Day-by-Day Itinerary Spreads ─────────────────────────────────────── */}
      {(include.itinerary ?? true) && days.length > 0 && (
        <section className="editorial-page">
          <SectionHeader title="Daily Chronicle" subtitle="Day by Day Itinerary" accentColor="#e11d48" />
          <div className="space-y-12">
            {days.map((day, idx) => {
              const isEven = idx % 2 === 1;
              const img1 = dayImages[idx] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80';
              const img2 = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80';
              const img3 = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';

              return (
                <div key={idx} className={`day-spread-grid ${isEven ? 'reverse' : ''}`}>
                  <div>
                    <div className="day-number-large">0{day.day || idx + 1}</div>
                    <h3 className="text-2xl font-bold text-slate-900 m-0 mb-3 font-display">{safeText(day.title || `Day ${idx + 1}`)}</h3>
                    <p className="text-slate-600 leading-relaxed text-sm m-0 mb-4">{safeText(day.description || 'Spend the day exploring local landmarks and cultural sites at your own leisurely pace.')}</p>
                    
                    <DayInventorySections day={day} theme={{ colors: { primary: '#0f172a', textSecondary: '#475569' } }} accentColor="#e11d48" />
                  </div>

                  <div className="photo-collage">
                    <img src={img1} alt="" />
                    <img src={img2} alt="" />
                    <img src={img3} alt="" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Accommodations & Hotels ─────────────────────────────────────────── */}
      {(include.hotels ?? true) && (items.hotel || []).length > 0 && (
        <section className="editorial-page">
          <SectionHeader title="Sanctuaries" subtitle="Selected Accommodations" accentColor="#e11d48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(items.hotel || []).map((hotel, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                <div className="h-48 bg-slate-100 relative">
                  <img src={hotel.meta?.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'} alt="" className="w-full h-full object-cover" />
                  <span className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow">
                    5 &starf; Luxury
                  </span>
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-lg text-slate-900 m-0 mb-1">{hotel.label}</h4>
                  <p className="text-xs text-slate-500 m-0 mb-4">{hotel.meta?.location || p.destination || 'Prime City Location'}</p>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <span>{hotel.qty || 1} Night(s) Included</span>
                    {visibilityMode === 'ITEMIZED' && <span className="text-rose-600 font-bold">{formatPrice(hotel.unit_price || 0, currency)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Investment / Costing ────────────────────────────────────────────── */}
      {(include.costing ?? true) && total > 0 && visibilityMode !== 'HIDDEN' && (
        <section className="editorial-page">
          <SectionHeader title="Investment" subtitle="Cost Breakdown" accentColor="#e11d48" />
          <table className="costing-table">
            <thead>
              <tr>
                <th>Service / Component</th>
                {visibilityMode === 'ITEMIZED' && (
                  <>
                    <th className="text-center">Qty / Duration</th>
                    <th className="text-right">Rate</th>
                  </>
                )}
                <th className="text-right">Total ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {visibilityMode === 'ITEMIZED' && Object.entries(items).flatMap(([kind, list]) =>
                list.map((it, idx) => {
                  const qty = Number(it.qty) || 1;
                  const unit = Number(it.unit_price) || 0;
                  const itemTotal = qty * unit;
                  return (
                    <tr key={`${kind}-${idx}`}>
                      <td className="font-medium text-slate-800">
                        <span className="text-xs uppercase tracking-wider text-slate-400 block">{kind}</span>
                        {it.label}
                      </td>
                      <td className="text-center text-slate-600">{qty}</td>
                      <td className="text-right text-slate-600">{formatPrice(unit, currency)}</td>
                      <td className="text-right font-bold text-slate-900">{formatPrice(itemTotal, currency)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={visibilityMode === 'ITEMIZED' ? 3 : 1} className="pt-6 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Total Investment</td>
                <td className="pt-6 text-right font-black text-2xl text-rose-600">{formatPrice(total, currency)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="cta-box">
            <h3 className="text-2xl font-bold m-0 mb-2 font-display">Ready to Embark?</h3>
            <p className="text-slate-300 text-sm max-w-md mx-auto m-0 mb-6">
              Approve your curated itinerary with one click and let your dedicated curator finalize reservations immediately.
            </p>
            <div className="inline-block bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer">
              Approve & Confirm Reservations &rarr;
            </div>
          </div>
        </section>
      )}

      {/* ─── Inclusions & Terms ──────────────────────────────────────────────── */}
      {(include.inclusions ?? true) && (
        <section className="editorial-page text-xs text-slate-600 border-t border-slate-200 pt-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold uppercase tracking-wider text-slate-900 mb-2">Included in Your Journey</h4>
              <ul className="list-disc pl-4 space-y-1 m-0">
                <li>All accommodation as stated with breakfast</li>
                <li>Private airport transfers and inter-city transport</li>
                <li>24/7 on-ground concierge support</li>
                <li>All applicable local taxes and service charges</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-wider text-slate-900 mb-2">Important Terms</h4>
              <p className="m-0 leading-relaxed">
                Proposal validity is 14 days from issuance. Reservations are subject to availability at the time of confirmation. Standard agency cancellation policies apply.
              </p>
            </div>
          </div>
        </section>
      )}
      <UniversalTemplateExtras proposal={p} branding={b} customBlocks={customBlocks} order={order} style={props.style || 'editorial'} theme={{ typography: { headline: "'Noto Serif JP', serif", body: "'Inter', sans-serif" }, colors: { primary: '#0f172a', accent: '#e11d48' } }} />
    </div>
  );
}
