import React from 'react';
import GlassCard from '../utility/GlassCard.jsx';
import SectionDivider from '../utility/SectionDivider.jsx';

/**
 * Costing & Investment Section component.
 * Displays proposal pricing breakdown, itemized costs, taxes, and total investment.
 * Supports 5 variants: glass-table, minimal-breakdown, luxury-invoice, category-cards, executive-summary
 */
export default function CostingSection({ items = [], proposal = {}, theme = {}, variant = 'glass-table', currency = 'INR' }) {
  const primaryColor = theme.colors?.primary || '#1a1a2e';
  const accentColor = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const dividerType = theme.effects?.sectionDivider || 'elegant-line';

  const formatPrice = (val) => {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
    } catch {
      return `₹${val.toLocaleString()}`;
    }
  };

  // Group items by kind
  const grouped = {};
  let total = 0;
  for (const it of items) {
    const k = (it.kind || 'other').toLowerCase();
    const qty = Number(it.qty) || 1;
    const price = Number(it.unit_price || it.price) || 0;
    const itemTotal = qty * price;
    total += itemTotal;
    if (!grouped[k]) grouped[k] = { label: k.toUpperCase(), items: [], subtotal: 0 };
    grouped[k].items.push({ ...it, itemTotal });
    grouped[k].subtotal += itemTotal;
  }

  // If no items have price, check proposal overall total
  const proposalTotal = proposal.total_amount || proposal.price || total || 0;

  // ─── 1. Luxury Invoice Variant ─────────────────────────────────────────
  if (variant === 'luxury-invoice') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-5xl mx-auto">
        <GlassCard theme={theme} className="p-8 md:p-14 border-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 border-b-2" style={{ borderColor: primaryColor }}>
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold block mb-1" style={{ color: accentColor }}>Investment Summary</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
                Proposal Quotation
              </h2>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div className="text-xs uppercase tracking-wider text-gray-500">Proposal Date</div>
              <div className="font-mono text-sm font-semibold">{new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div className="py-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: theme.colors?.border }}>
                  <th className="py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: textSec }}>Category & Description</th>
                  <th className="py-3 font-semibold text-xs uppercase tracking-wider text-center" style={{ color: textSec }}>Qty / Nights</th>
                  <th className="py-3 font-semibold text-xs uppercase tracking-wider text-right" style={{ color: textSec }}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: theme.colors?.border }}>
                {Object.entries(grouped).map(([kind, group]) => (
                  <React.Fragment key={kind}>
                    <tr className="bg-opacity-5" style={{ backgroundColor: theme.colors?.surfaceAlt }}>
                      <td colSpan="3" className="py-2.5 px-3 font-bold text-xs uppercase tracking-widest" style={{ color: accentColor }}>
                        {group.label}
                      </td>
                    </tr>
                    {group.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-black/5 transition-colors">
                        <td className="py-3 pl-6 pr-3">
                          <div className="font-semibold text-sm" style={{ color: primaryColor }}>{it.label || it.name || 'Service Item'}</div>
                          {it.desc && <div className="text-xs text-gray-500 mt-0.5">{it.desc}</div>}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-sm">{it.qty || 1}</td>
                        <td className="py-3 pl-3 text-right font-mono font-medium text-sm" style={{ color: primaryColor }}>{formatPrice(it.itemTotal)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-6 border-t-2 flex flex-col md:flex-row justify-between items-center" style={{ borderColor: primaryColor }}>
            <div className="text-xs text-gray-500 max-w-md mb-4 md:mb-0">
              * Quotation includes all applicable taxes, service charges, and VIP concierge handling fees. Rates are subject to availability at the time of confirmation.
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total Investment</div>
              <div className="text-3xl md:text-4xl font-serif font-bold" style={{ color: primaryColor }}>
                {formatPrice(proposalTotal)}
              </div>
            </div>
          </div>
        </GlassCard>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 2. Category Cards Variant ─────────────────────────────────────────
  if (variant === 'category-cards') {
    return (
      <section className="py-16 px-8 md:px-16 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Investment Breakdown</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
            Trip Costing by Category
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {Object.entries(grouped).map(([kind, group]) => (
            <GlassCard key={kind} theme={theme} className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: theme.colors?.border }}>
                  <h4 className="font-bold text-base uppercase tracking-wider" style={{ color: accentColor }}>{group.label}</h4>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/5">{group.items.length} items</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {group.items.slice(0, 4).map((it, idx) => (
                    <li key={idx} className="flex justify-between text-xs">
                      <span className="truncate max-w-[180px]" style={{ color: textSec }}>{it.label || 'Item'}</span>
                      <span className="font-mono font-medium">{formatPrice(it.itemTotal)}</span>
                    </li>
                  ))}
                  {group.items.length > 4 && <li className="text-xs italic text-gray-400">+{group.items.length - 4} more items...</li>}
                </ul>
              </div>
              <div className="pt-3 border-t flex justify-between items-center mt-auto" style={{ borderColor: theme.colors?.border }}>
                <span className="text-xs uppercase font-semibold">Subtotal</span>
                <span className="text-base font-bold font-mono" style={{ color: primaryColor }}>{formatPrice(group.subtotal)}</span>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="p-8 rounded-2xl border text-center max-w-2xl mx-auto" style={{ backgroundColor: theme.colors?.surfaceAlt, borderColor: theme.colors?.border }}>
          <span className="text-xs uppercase tracking-widest block mb-1 text-gray-500">Total Estimated Investment</span>
          <div className="text-4xl md:text-5xl font-serif font-bold my-2" style={{ color: primaryColor }}>{formatPrice(proposalTotal)}</div>
          <span className="text-xs text-green-600 font-medium">✓ Inclusive of all taxes and fees</span>
        </div>
        <SectionDivider variant={dividerType} theme={theme} />
      </section>
    );
  }

  // ─── 3. Default: Glass Table / Minimal Breakdown Variant ───────────────
  return (
    <section className="py-16 px-8 md:px-16 max-w-5xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs uppercase tracking-widest font-semibold block mb-2" style={{ color: accentColor }}>Quotation</span>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4" style={{ color: primaryColor, fontFamily: theme.typography?.headline }}>
          Investment & Pricing
        </h2>
      </div>

      <GlassCard theme={theme} className="p-6 md:p-10 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b pb-3" style={{ borderColor: theme.colors?.border }}>
              <th className="pb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: textSec }}>Item / Description</th>
              <th className="pb-3 text-xs uppercase tracking-wider font-semibold text-center" style={{ color: textSec }}>Category</th>
              <th className="pb-3 text-xs uppercase tracking-wider font-semibold text-right" style={{ color: textSec }}>Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ divideColor: theme.colors?.border }}>
            {items.map((it, idx) => {
              const itemPrice = (Number(it.unit_price || it.price) || 0) * (Number(it.qty) || 1);
              return (
                <tr key={idx} className="hover:bg-black/5 transition-colors">
                  <td className="py-3.5 pr-4">
                    <div className="font-semibold text-sm" style={{ color: primaryColor }}>{it.label || it.name || 'Service Item'}</div>
                    {it.desc && <div className="text-xs text-gray-500 mt-0.5">{it.desc}</div>}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-xs px-2.5 py-1 rounded-full uppercase tracking-wider font-mono bg-black/5">
                      {it.kind || 'general'}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 text-right font-mono font-semibold text-sm" style={{ color: primaryColor }}>
                    {formatPrice(itemPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 pt-4" style={{ borderColor: primaryColor }}>
              <td colSpan="2" className="pt-6 font-bold text-base uppercase tracking-wider" style={{ color: primaryColor }}>
                Total Proposal Investment
              </td>
              <td className="pt-6 text-right font-serif font-bold text-2xl md:text-3xl" style={{ color: accentColor }}>
                {formatPrice(proposalTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </GlassCard>
      <SectionDivider variant={dividerType} theme={theme} />
    </section>
  );
}
