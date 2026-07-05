import React from 'react';
import { incrementAnalytics } from '../../services/analyticsService.js';

export default function UniversalTemplateExtras({ proposal = {}, branding = {}, customBlocks = [], order = [], style = 'classic', theme = {}, renderedKeys = [] }) {
  const fontHeadline = branding.font_headline || theme.typography?.headline || 'serif';
  const fontBody = branding.font_body || theme.typography?.body || 'sans-serif';
  const fontSubhead = branding.font_subhead || fontHeadline;
  const primaryColor = theme.colors?.primary || theme.text || '#1a1a2e';
  const accentColor = theme.colors?.accent || theme.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || theme.text || '#64748b';
  const bgColor = theme.colors?.bg || theme.bg || 'transparent';

  // Find any custom blocks that were not rendered by the main loop
  const unrenderedCustomBlocks = (customBlocks || []).filter(cb => !renderedKeys.includes(cb.id));

  return (
    <div className="universal-template-extras w-full no-print-break">
      {/* 1. Unrendered Custom Blocks / Sections */}
      {unrenderedCustomBlocks.map(cb => {
        const contentVal = cb.content || '';
        return (
          <section key={cb.id} className="py-12 px-8 md:px-16 max-w-7xl mx-auto editorial-section break-inside-avoid my-8 border-t border-outline-variant/30">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 border-b pb-3" style={{ color: primaryColor, fontFamily: fontHeadline, borderColor: accentColor }}>
              {cb.label}
            </h2>
            {cb.type === 'text' ? (
              <div className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: textSec, fontFamily: fontBody }}>
                {contentVal || '—'}
              </div>
            ) : cb.type === 'list' || cb.type === 'checklist' ? (
              <ul className="space-y-3 mt-4" style={{ color: textSec, fontFamily: fontBody }}>
                {(Array.isArray(contentVal) ? contentVal : contentVal.split('\n')).map((item, i) => item.trim() && (
                  <li key={i} className="flex items-start gap-3 text-base">
                    <span className="material-symbols-outlined text-sm mt-1 flex-shrink-0" style={{ color: accentColor }}>check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : cb.type === 'image' ? (
              contentVal ? (
                <div className="mt-4 rounded-2xl overflow-hidden shadow-xl border border-outline-variant/50">
                  <img src={contentVal} className="w-full max-h-[600px] object-cover break-inside-avoid" alt={cb.label} />
                </div>
              ) : null
            ) : (
              <div className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: textSec, fontFamily: fontBody }}>
                {contentVal || '—'}
              </div>
            )}
          </section>
        );
      })}

      {/* 2. Custom Branding Fields (Text, Checklist, Image) */}
      {Array.isArray(branding?.custom_fields) && branding.custom_fields.length > 0 && (
        <div className="editorial-section break-inside-avoid page-break-inside-avoid px-[14mm] py-8 my-8 text-center border-y" style={{ borderColor: accentColor + '30', backgroundColor: bgColor }}>
          <h3 className="text-xs uppercase tracking-[0.25em] font-bold opacity-60 mb-6 block" style={{ color: primaryColor, fontFamily: fontSubhead }}>
            Agency Accreditations & Brand Specifications
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-6 max-w-5xl mx-auto">
            {branding.custom_fields.map((cf, idx) => {
              if (!cf.label && !cf.value) return null;
              if (cf.type === 'checklist' || cf.type === 'list') {
                const items = Array.isArray(cf.value) ? cf.value : (cf.value || '').split('\n');
                return (
                  <div key={cf.id || idx} className="w-full max-w-md my-2 p-5 rounded-2xl border text-left shadow-sm bg-white/80 dark:bg-black/40 backdrop-blur-sm" style={{ borderColor: accentColor + '40' }}>
                    {cf.label && <span className="text-xs uppercase tracking-widest font-bold block mb-3" style={{ color: accentColor, fontFamily: fontSubhead }}>{cf.label}</span>}
                    <ul className="space-y-2 text-sm">
                      {items.map((item, i) => item.trim() && (
                        <li key={i} className="flex items-start gap-2.5" style={{ color: textSec, fontFamily: fontBody }}>
                          <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: accentColor }}>check_box</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              } else if (cf.type === 'image') {
                return (
                  <div key={cf.id || idx} className="flex flex-col items-center p-3 my-2 bg-white/60 dark:bg-black/30 rounded-xl border border-outline-variant/50 shadow-sm">
                    {cf.label && <span className="text-[11px] uppercase tracking-widest font-bold opacity-75 mb-2.5" style={{ color: primaryColor, fontFamily: fontSubhead }}>{cf.label}</span>}
                    {cf.value ? <img src={cf.value} alt={cf.label || 'Brand Media'} className="max-h-40 object-contain rounded-lg shadow-sm" /> : null}
                  </div>
                );
              } else {
                return (
                  <div key={cf.id || idx} className="flex flex-col items-center px-6 py-3.5 rounded-xl border border-outline-variant/40 bg-white/50 dark:bg-black/20 shadow-sm min-w-[160px]">
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-60 mb-1" style={{ color: primaryColor, fontFamily: fontSubhead }}>{cf.label}</span>
                    <span className="text-sm font-bold whitespace-pre-wrap" style={{ color: accentColor, fontFamily: fontBody }}>{cf.value}</span>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* 3. Luxury Action Footer for WhatsApp Approval & Modifications */}
      <div className="editorial-section break-inside-avoid page-break-inside-avoid p-[14mm] mt-12 text-center" style={{ backgroundColor: bgColor, color: primaryColor, fontFamily: fontBody }}>
        <div className="max-w-3xl mx-auto p-10 rounded-3xl border shadow-xl bg-white/90 dark:bg-black/80 backdrop-blur-md" style={{ borderColor: accentColor + '50' }}>
          <span className="text-xs uppercase tracking-[0.3em] font-bold block mb-2" style={{ color: accentColor, fontFamily: fontSubhead }}>
            Client Authorisations
          </span>
          <h3 className="text-3xl md:text-4xl mb-4 uppercase tracking-wider font-bold" style={{ fontFamily: fontHeadline, color: primaryColor }}>
            Ready to Begin Your Journey?
          </h3>
          <p className="text-base opacity-80 max-w-xl mx-auto mb-10 font-light leading-relaxed" style={{ fontFamily: fontSubhead, color: textSec }}>
            We are dedicated to crafting an immaculate travel experience. Connect with your dedicated curator instantly via WhatsApp to finalize your booking or refine any details.
          </p>
          {(() => {
            const originUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:3000';
            const cleanPhone = (branding.contact_phone || proposal.contact_phone || '+919876543210').replace(/[^0-9]/g, '');
            const pid = proposal?.id || proposal?.proposal_id || '';
            const cname = proposal?.client_name || proposal?.client?.name || proposal?.client || 'Client';
            const dest = proposal?.destination || 'Trip';
            const pname = proposal?.name || 'Custom Plan';
            const approveUrl = `${originUrl}/proposal-action?type=approval&id=${pid}&client=${encodeURIComponent(cname)}&dest=${encodeURIComponent(dest)}&phone=${cleanPhone}&name=${encodeURIComponent(pname)}`;
            const modifyUrl = `${originUrl}/proposal-action?type=modification&id=${pid}&client=${encodeURIComponent(cname)}&dest=${encodeURIComponent(dest)}&phone=${cleanPhone}&name=${encodeURIComponent(pname)}`;
            return (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 no-print">
                <a
                  onClick={() => incrementAnalytics('approval', pid, dest, cname)}
                  href={approveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold tracking-wider uppercase text-xs shadow-xl transition-all flex items-center justify-center gap-2.5 no-underline hover:opacity-95 hover:scale-[1.02] transform duration-200 cursor-pointer"
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
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold tracking-wider uppercase text-xs shadow-md transition-all flex items-center justify-center gap-2.5 no-underline border hover:opacity-95 hover:scale-[1.02] transform duration-200 cursor-pointer"
                  style={{ backgroundColor: bgColor, color: primaryColor, borderColor: accentColor }}
                >
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                  Request Modifications
                </a>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
