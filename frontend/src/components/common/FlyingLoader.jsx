import React from 'react';

/**
 * FlyingLoader
 * A reusable loader that displays a floating/flying airplane icon instead of a generic spinner.
 *
 * @param {string} size - Tailwind text size class (default: 'text-3xl')
 * @param {string} color - Tailwind text color class (default: 'text-primary')
 * @param {string} className - Additional CSS classes
 */
export default function FlyingLoader({ size = 'text-3xl', color = 'text-primary', className = '' }) {
  return (
    <>
      <style>{`
        @keyframes qgFlyGlobal { 
          0%, 100% { transform: translateY(0) rotate(25deg) scale(1.1); } 
          50% { transform: translateY(-8px) rotate(25deg) scale(1.1); } 
        }
      `}</style>
      <span
        className={`material-symbols-outlined ${size} ${color} ${className}`}
        style={{ animation: 'qgFlyGlobal 1.5s ease-in-out infinite' }}
      >
        flight
      </span>
    </>
  );
}
