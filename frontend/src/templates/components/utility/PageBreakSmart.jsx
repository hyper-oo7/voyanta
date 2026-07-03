import React from 'react';

/**
 * Smart page break component for A4 PDF rendering.
 * Forces a clean page break before or after a major section when rendering in print mode.
 */
export default function PageBreakSmart({ mode = 'before', className = '' }) {
  const breakClass = mode === 'before' ? 'engine-page-break-before' : 'engine-page-break-after';
  return <div className={`hidden print:block w-full h-px ${breakClass} ${className}`} aria-hidden="true" />;
}
