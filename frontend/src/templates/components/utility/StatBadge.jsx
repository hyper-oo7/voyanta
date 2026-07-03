import React from 'react';

/**
 * Reusable Stat Badge / Pill for duration, travelers, pricing, tags, etc.
 * Supports pill, square, and ribbon styles from theme decorations.
 */
export default function StatBadge({ label, icon, theme = {}, variant, className = '' }) {
  if (!label) return null;

  const styleType = variant || theme.decorations?.badgeStyle || 'pill';
  const accent = theme.colors?.accent || '#c41e3a';
  const textOnAccent = theme.colors?.textOnAccent || '#ffffff';
  const radius = styleType === 'pill' ? '9999px' : styleType === 'square' ? '0.375rem' : '0.125rem';

  return (
    <span
      className={`inline-flex items-center px-3 py-1 font-medium text-xs tracking-wide uppercase select-none ${className}`}
      style={{
        backgroundColor: accent,
        color: textOnAccent,
        borderRadius: radius,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {icon && <span className="material-symbols-outlined mr-1" style={{ fontSize: '14px' }}>{icon}</span>}
      {label}
    </span>
  );
}
