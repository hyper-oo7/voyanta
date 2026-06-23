import { useEffect, useRef } from 'react';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaHotelLibrary_bodyClass, VoyantaHotelLibrary_extraStyles, VoyantaHotelLibrary_html } from './_html/voyanta_hotel_library.js';
import { fetchHotels } from '../services/hotelService.js';

export default function HotelLibraryPage() {
  const wrapperRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hotels = await fetchHotels();
      if (cancelled || !wrapperRef.current) return;
      // Lightweight badge: replace the result count if it exists.
      const root = wrapperRef.current;
      const counter = root.querySelector('[data-result-count]');
      if (counter) counter.textContent = `${hotels.length} results`;
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div ref={wrapperRef}>
      <StitchPage
        styleId="stitch-style-hotel-library"
        bodyClass={VoyantaHotelLibrary_bodyClass}
        extraStyles={VoyantaHotelLibrary_extraStyles}
        html={VoyantaHotelLibrary_html}
        navMap={navMap}
      />
    </div>
  );
}
