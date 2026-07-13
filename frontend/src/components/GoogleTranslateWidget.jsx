import React, { useEffect } from 'react';

export default function GoogleTranslateWidget() {
  useEffect(() => {
    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = () => {
      if (window.google?.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,pa,ml',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        );
      }
    };

    const addScript = () => {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      document.body.appendChild(script);
    };

    addScript();
  }, []);

  return (
    <div className="google-translate-floater no-print">
      <div className="flex items-center gap-2 bg-surface-container border border-outline-variant p-2 rounded-full shadow-lg">
        <span className="material-symbols-outlined text-primary text-[18px]">translate</span>
        <div id="google_translate_element" className="translate-widget-container"></div>
      </div>
      <style>{`
        .google-translate-floater {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          font-family: inherit;
        }
        .translate-widget-container {
          display: inline-block;
        }
        .goog-te-gadget-simple {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          font-size: 11px !important;
          font-weight: bold !important;
          display: flex !important;
          align-items: center !important;
          color: var(--on-surface) !important;
        }
        .goog-te-gadget-simple img {
          display: none !important;
        }
        .goog-te-gadget-simple span {
          color: var(--on-surface) !important;
        }
        .goog-te-menu-value {
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
        }
        .goog-te-menu-value span:nth-child(3) {
          display: none !important; /* Hide dropdown arrow */
        }
        iframe.goog-te-banner-frame {
          display: none !important;
        }
        body {
          top: 0px !important;
        }
      `}</style>
    </div>
  );
}
