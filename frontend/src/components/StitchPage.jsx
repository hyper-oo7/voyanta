// Reusable Stitch HTML page renderer with universal click interception.
//
// Responsibilities:
// 1. Renders Stitch's body HTML verbatim (no styling changes).
// 2. Injects each page's <style> block once into <head>.
// 3. Applies the page's body class while mounted.
// 4. Intercepts <a> clicks:
//    - "#section" hash → smooth scroll to the in-page section (if it exists).
//    - label in NAV_MAP → React Router navigate.
//    - href="#" placeholder with no mapping → "Coming soon" toast (no dead nav).
// 5. Intercepts <button> clicks:
//    - label in NAV_MAP → navigate.
//    - label in COMING_SOON_LABELS → toast.
//    - Otherwise: untouched (lets per-page handlers do their thing).
//
// Per-page wiring (e.g. dashboard's "Create New Proposal") can still attach
// listeners directly to DOM nodes — those run BEFORE this delegated handler
// (which lives on the wrapper) thanks to capture: false; or, if attached as
// .onclick, this delegated handler is also unaffected since we only act on
// labels we recognise.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import NAV_MAP, { HASH_SECTION_MAP, COMING_SOON_LABELS } from '../lib/navMap.js';

export default function StitchPage({
  bodyClass = '',
  extraStyles = '',
  html = '',
  styleId,
  navMap = NAV_MAP,
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!extraStyles || !styleId) return;
    if (document.getElementById(styleId)) return;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = extraStyles;
    document.head.appendChild(el);
  }, [extraStyles, styleId]);

  useEffect(() => {
    if (!bodyClass) return;
    document.body.className = bodyClass;
  }, [bodyClass]);

  // Universal click interception + sidebar augmentation
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Add an "Itinerary" sidebar entry if not already present.
    const sidebarNav = root.querySelector('aside nav');
    if (sidebarNav && !sidebarNav.querySelector('[data-extra-nav="itinerary"]')) {
      const proposalsLink = Array.from(sidebarNav.querySelectorAll('a')).find((a) =>
        a.querySelector('.font-label-md')?.textContent?.trim() === 'Proposals'
      );
      if (proposalsLink) {
        const itin = document.createElement('a');
        itin.setAttribute('href', '#');
        itin.setAttribute('data-extra-nav', 'itinerary');
        itin.className = 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
        itin.innerHTML = '<span class="material-symbols-outlined">route</span><span class="font-label-md text-label-md">Itinerary</span>';
        proposalsLink.parentNode.insertBefore(itin, proposalsLink.nextSibling);
      }
    }

    const handler = (e) => {
      // Anchor clicks
      const a = e.target.closest('a');
      if (a) {
        const href = a.getAttribute('href') || '';
        const labelEl = a.querySelector('.font-label-md, .font-label-sm');
        const label = (labelEl ? labelEl.textContent : a.textContent || '').trim();

        // Smooth scroll for in-page hash anchors
        if (href.startsWith('#') && href.length > 1) {
          const sectionId = HASH_SECTION_MAP[href] || href.slice(1);
          const target = document.getElementById(sectionId);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        }

        // Labelled route
        const mapped = navMap[label];
        if (mapped) {
          e.preventDefault();
          navigate(mapped);
          return;
        }

        // Dead placeholder href="#" — show a soft toast, don't reload
        if (href === '#') {
          e.preventDefault();
          if (label && COMING_SOON_LABELS.has(label)) toast.info(`${label} — coming soon`);
          return;
        }
        return;
      }

      // Button clicks — let per-page handlers run first; only act if button
      // hasn't already been handled.
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.type === 'submit') return;   // forms own their submit buttons
      if (e.defaultPrevented) return;
      if (btn.onclick) return;             // page-specific handler owns this button
      // Prefer the labelled span; fall back to full textContent
      const labelEl = btn.querySelector('.font-label-md, .font-label-sm');
      const text = (labelEl ? labelEl.textContent : btn.textContent || '').trim();
      const stripped = text.replace(/^[a-z_]+\s/, '').replace(/\s[a-z_]+$/, '').trim();
      const label = navMap[stripped] ? stripped : (navMap[text] ? text : '');
      if (label) {
        e.preventDefault();
        navigate(navMap[label]);
        return;
      }
      if (COMING_SOON_LABELS.has(stripped) || COMING_SOON_LABELS.has(text)) {
        e.preventDefault();
        toast.info(`${stripped || text} — coming soon`);
      }
    };
    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [navMap, navigate, toast]);

  return (
    <div ref={containerRef} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
