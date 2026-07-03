import React from 'react';

/**
 * Reusable Glassmorphic or Solid card container that respects theme settings
 * and adapts automatically for print/PDF rendering.
 */
export default function GlassCard({ children, theme = {}, className = '', style = {}, onClick, hoverEffect = true }) {
  const isGlass = theme.effects?.glassMorphism;
  const bg = isGlass ? (theme.effects?.glassBackground || 'rgba(255,255,255,0.75)') : (theme.colors?.surface || '#ffffff');
  const blur = theme.effects?.glassBlur || '12px';
  const border = theme.colors?.border || '#e2e8f0';
  const shadow = theme.effects?.cardShadow || '0 8px 32px rgba(0,0,0,0.06)';
  const radius = theme.effects?.borderRadius || '1rem';

  const cardStyle = {
    backgroundColor: bg,
    backdropFilter: isGlass ? `blur(${blur})` : 'none',
    WebkitBackdropFilter: isGlass ? `blur(${blur})` : 'none',
    borderColor: border,
    boxShadow: shadow,
    borderRadius: radius,
    ...style,
  };

  return (
    <div
      className={`border transition-all duration-300 overflow-hidden ${hoverEffect ? 'hover:-translate-y-0.5 hover:shadow-xl' : ''} ${className}`}
      style={cardStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
