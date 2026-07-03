import React from 'react';

/**
 * Reusable Section Divider with 6 variants:
 * elegant-line, wave, gradient-fade, ornamental, double-line, none
 */
export default function SectionDivider({ variant = 'elegant-line', theme = {}, className = '' }) {
  if (variant === 'none') return null;

  const borderColor = theme.colors?.border || '#e2e8f0';
  const accentColor = theme.colors?.accent || '#c41e3a';

  if (variant === 'wave') {
    return (
      <div className={`w-full overflow-hidden my-8 opacity-60 ${className}`}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-6 text-current" style={{ color: borderColor }}>
          <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,45 L1200,120 L0,120 Z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (variant === 'gradient-fade') {
    return (
      <div 
        className={`h-0.5 w-full my-10 opacity-70 ${className}`} 
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
    );
  }

  if (variant === 'ornamental') {
    return (
      <div className={`flex items-center justify-center my-10 ${className}`}>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${borderColor})` }} />
        <span className="mx-4 text-xl select-none" style={{ color: accentColor }}>✦ ❖ ✦</span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${borderColor})` }} />
      </div>
    );
  }

  if (variant === 'double-line') {
    return (
      <div className={`my-10 border-t-4 border-double ${className}`} style={{ borderColor }} />
    );
  }

  // Default: elegant-line
  return (
    <div className={`flex items-center justify-center my-10 ${className}`}>
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${borderColor}, transparent)` }} />
      <span className="mx-3 text-lg opacity-80" style={{ color: accentColor }}>♦</span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${borderColor}, transparent)` }} />
    </div>
  );
}
