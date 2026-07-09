import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MediaCarousel({
  images = [],
  className = '',
  autoPlay = false,
  interval = 4500,
  altPrefix = 'Gallery image',
}) {
  const validImages = Array.isArray(images) && images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80'];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay || validImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, validImages.length, interval]);

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  return (
    <div className={`relative overflow-hidden group select-none ${className}`}>
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={currentIndex}
          src={validImages[currentIndex]}
          alt={`${altPrefix} ${currentIndex + 1}`}
          initial={{ opacity: 0.3, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0.3 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </AnimatePresence>

      {/* Navigation Arrows (Visible on hover when more than 1 image) */}
      {validImages.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md"
            aria-label="Previous image"
          >
            <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md"
            aria-label="Next image"
          >
            <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
          </button>

          {/* Indicator Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
            {validImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
