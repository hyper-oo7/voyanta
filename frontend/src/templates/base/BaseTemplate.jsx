import React from 'react';
import { formatPrice as libFormatPrice } from '../../lib/currency.js';

export function formatPrice(amount, currency = 'INR') {
  return libFormatPrice(amount, currency);
}

export function safeText(val) {
  if (Array.isArray(val)) return val.join('\n');
  if (val && typeof val === 'object') return JSON.stringify(val);
  return val ?? '';
}

export function SectionHeader({ title, subtitle, accentColor = '#e11d48' }) {
  return (
    <div className="mb-8 pb-4 border-b-2 flex items-baseline justify-between" style={{ borderColor: accentColor }}>
      <h2 className="text-3xl font-black uppercase tracking-wider m-0 font-display" style={{ color: accentColor }}>
        {title}
      </h2>
      {subtitle && (
        <span className="text-sm font-semibold tracking-widest uppercase opacity-70">
          {subtitle}
        </span>
      )}
    </div>
  );
}

export function PageBreak() {
  return <div className="print:break-before-page w-full h-1 my-4 bg-transparent" style={{ pageBreakBefore: 'always', breakBefore: 'always' }} />;
}
