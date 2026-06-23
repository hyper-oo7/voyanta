// Reusable Stitch HTML page renderer.
// Renders the Stitch HTML inside a container while preserving exact UI fidelity.
// Page-specific <style> blocks are injected once into <head>.
// Internal anchor clicks are intercepted and routed via React Router so the
// SPA navigation works on Stitch's static links.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Map: Stitch screen slug -> in-app route used when an anchor is clicked
// (anchors in Stitch HTML point to "#" so we use sensible defaults per page)
export default function StitchPage({
  bodyClass = '',
  extraStyles = '',
  html = '',
  styleId,
  // Map of [data-nav] anchor labels -> in-app routes (used for sidebar/topnav links)
  navMap = {},
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Inject page-specific styles once.
  useEffect(() => {
    if (!extraStyles || !styleId) return;
    if (document.getElementById(styleId)) return;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = extraStyles;
    document.head.appendChild(el);
  }, [extraStyles, styleId]);

  // Apply body class while page is mounted
  useEffect(() => {
    if (!bodyClass) return;
    const prev = document.body.className;
    document.body.className = bodyClass;
    return () => { document.body.className = prev; };
  }, [bodyClass]);

  // Intercept anchor clicks for SPA-style routing on internal nav links.
  // Stitch links contain a Material Symbol span + a label span; we read only
  // the label span so the navMap lookup matches "Hotels", not "hotelHotels".
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const handler = (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const labelEl = a.querySelector('.font-label-md, .font-label-sm');
      const label = (labelEl ? labelEl.textContent : a.textContent || '').trim();
      const mapped = navMap[label];
      if (mapped) {
        e.preventDefault();
        navigate(mapped);
      } else if (a.getAttribute('href') === '#') {
        // Prevent jarring `#` jumps for unmapped placeholder links.
        e.preventDefault();
      }
    };
    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [navMap, navigate]);

  return (
    <div ref={containerRef} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
