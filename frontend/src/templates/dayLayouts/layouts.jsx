import React from 'react';
import GlassCard from '../components/utility/GlassCard.jsx';
import StatBadge from '../components/utility/StatBadge.jsx';
import { DayInventorySections } from '../../components/common/UniversalTemplateExtras.jsx';

// ── Shared Helper for Activities Display ─────────────────────────────────────
function ActivityTags({ activities, accentColor, day, theme, vibe }) {
  if (day && (day.content || day.hotels || day.transfers || day.meals || day.activities)) {
    return <DayInventorySections day={day} theme={theme || {}} accentColor={accentColor} vibe={vibe} />;
  }
  if (!activities || !Array.isArray(activities) || activities.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {activities.map((act, i) => (
        <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-black/5 font-medium border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <span style={{ color: accentColor }}>✦</span> {act}
        </span>
      ))}
    </div>
  );
}

// ─── 1. Left Image Layout ────────────────────────────────────────────────────
export function LeftImage({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="flex flex-col md:flex-row gap-8 items-center py-6 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="w-full md:w-5/12 h-72 rounded-2xl overflow-hidden shadow-lg relative group">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <span className="absolute top-4 left-4 px-3 py-1 bg-black/70 backdrop-blur-md text-white rounded-full text-xs font-bold uppercase tracking-widest">
          Day 0{num}
        </span>
      </div>
      <div className="flex-1 space-y-4">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: accent }}>Daily Exploration</div>
        <h3 className="text-2xl md:text-3xl font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>
          {day.title || `Day ${num}: Discovery & Adventure`}
        </h3>
        <p className="text-sm md:text-base leading-relaxed" style={{ color: textSec }}>
          {day.description || 'Spend the day exploring iconic landmarks, cultural treasures, and scenic views at your leisure.'}
        </p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 2. Right Image Layout ───────────────────────────────────────────────────
export function RightImage({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="flex flex-col md:flex-row-reverse gap-8 items-center py-6 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="w-full md:w-5/12 h-72 rounded-2xl overflow-hidden shadow-lg relative group">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <span className="absolute top-4 right-4 px-3 py-1 bg-black/70 backdrop-blur-md text-white rounded-full text-xs font-bold uppercase tracking-widest">
          Day 0{num}
        </span>
      </div>
      <div className="flex-1 space-y-4">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: accent }}>Daily Exploration</div>
        <h3 className="text-2xl md:text-3xl font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>
          {day.title || `Day ${num}: Discovery & Adventure`}
        </h3>
        <p className="text-sm md:text-base leading-relaxed" style={{ color: textSec }}>
          {day.description || 'Spend the day exploring iconic landmarks, cultural treasures, and scenic views at your leisure.'}
        </p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 3. Top Image Layout ─────────────────────────────────────────────────────
export function TopImage({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-8 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="w-full h-80 rounded-2xl overflow-hidden shadow-xl mb-6 relative group">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-6">
          <div className="text-white">
            <span className="text-xs uppercase tracking-widest font-semibold text-amber-300 block mb-1">Day 0{num} Chronicle</span>
            <h3 className="text-3xl font-serif font-bold" style={{ fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
          </div>
        </div>
      </div>
      <p className="text-base leading-relaxed max-w-4xl" style={{ color: textSec }}>
        {day.description || 'Spend the day exploring iconic landmarks, cultural treasures, and scenic views at your leisure.'}
      </p>
      <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
    </div>
  );
}

// ─── 4. Bottom Gallery Layout ────────────────────────────────────────────────
export function BottomGallery({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-8 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="flex items-center gap-4 mb-4">
        <span className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-md" style={{ backgroundColor: primary }}>
          0{num}
        </span>
        <div>
          <span className="text-xs uppercase tracking-widest font-semibold block" style={{ color: accent }}>Daily Itinerary</span>
          <h3 className="text-2xl font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        </div>
      </div>
      <p className="text-base leading-relaxed mb-6" style={{ color: textSec }}>
        {day.description || 'Spend the day exploring iconic landmarks, cultural treasures, and scenic views at your leisure.'}
      </p>
      <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="h-40 rounded-xl overflow-hidden shadow">
          <img src={dayImage} alt="g1" className="w-full h-full object-cover" />
        </div>
        <div className="h-40 rounded-xl overflow-hidden shadow">
          <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" alt="g2" className="w-full h-full object-cover" />
        </div>
        <div className="h-40 rounded-xl overflow-hidden shadow">
          <img src="https://images.unsplash.com/photo-1516483638261-f408892287c4?auto=format&fit=crop&w=600&q=80" alt="g3" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

// ─── 5. Masonry Gallery Layout ───────────────────────────────────────────────
export function MasonryGallery({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-8 border-b grid grid-cols-1 md:grid-cols-12 gap-8 items-center" style={{ borderColor: theme.colors?.border }}>
      <div className="md:col-span-6 space-y-4">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: accent }}>Day 0{num}</div>
        <h3 className="text-3xl font-serif font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'Immerse yourself in scenic beauty and private tours.'}</p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
      <div className="md:col-span-6 grid grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl overflow-hidden shadow-lg">
          <img src={dayImage} alt="m1" className="w-full h-full object-cover" />
        </div>
        <div className="h-64 rounded-2xl overflow-hidden shadow-lg mt-6">
          <img src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80" alt="m2" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

// ─── 6. Pinterest Style Layout ───────────────────────────────────────────────
export function PinterestStyle({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <GlassCard theme={theme} className="p-6 md:p-8 mb-8">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/3">
          <div className="h-60 rounded-xl overflow-hidden mb-4 shadow">
            <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
          </div>
          <span className="text-xs uppercase tracking-widest font-semibold block text-center" style={{ color: accent }}>Day 0{num} Highlight</span>
        </div>
        <div className="md:w-2/3 flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
            <p className="text-sm md:text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'An inspiring day full of memorable moments.'}</p>
          </div>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
      </div>
    </GlassCard>
  );
}

// ─── 7. Magazine Editorial Layout ────────────────────────────────────────────
export function MagazineEditorial({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-12 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="flex items-baseline gap-6 mb-6">
        <span className="text-6xl md:text-8xl font-serif font-bold opacity-20 select-none" style={{ color: primary, fontFamily: theme.typography?.headline }}>
          0{num}
        </span>
        <div>
          <span className="text-xs uppercase tracking-[0.25em] font-semibold block mb-1" style={{ color: accent }}>Chronicle of the Day</span>
          <h3 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-7 space-y-6">
          <p className="text-lg font-serif italic leading-relaxed pl-4 border-l-2" style={{ color: primary, borderColor: accent }}>
            "{day.description || 'Every moment of today is engineered for wonder, luxury, and cultural depth.'}"
          </p>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
        <div className="md:col-span-5">
          <div className="h-72 rounded-2xl overflow-hidden shadow-xl relative group">
            <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-black/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 8. Timeline Layout ──────────────────────────────────────────────────────
export function Timeline({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="flex gap-6 py-6 border-b relative" style={{ borderColor: theme.colors?.border }}>
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md z-10 flex-shrink-0" style={{ backgroundColor: primary }}>
          D{num}
        </div>
        <div className="w-0.5 flex-1 bg-gray-200 my-2" />
      </div>
      <div className="flex-1 pb-6">
        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: accent }}>Schedule</div>
        <h3 className="text-2xl font-bold mb-3" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: textSec }}>{day.description || 'An unforgettable day of private excursions.'}</p>
        <div className="h-56 rounded-xl overflow-hidden shadow-md mb-4 max-w-lg">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 9. Split Screen Layout ──────────────────────────────────────────────────
export function SplitScreen({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;
  const isEven = index % 2 === 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[350px] rounded-2xl overflow-hidden shadow-lg mb-8 border" style={{ borderColor: theme.colors?.border }}>
      <div className={`h-64 md:h-auto relative ${isEven ? 'md:order-2' : ''}`}>
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        <span className="absolute top-4 left-4 px-3 py-1 bg-black/70 text-white text-xs font-bold uppercase tracking-widest rounded-full">
          Day 0{num}
        </span>
      </div>
      <div className={`p-8 md:p-12 flex flex-col justify-center bg-white ${isEven ? 'md:order-1' : ''}`}>
        <span className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: accent }}>Itinerary Segment</span>
        <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: textSec }}>{day.description || 'Explore the wonders of your destination in complete luxury.'}</p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 10. Floating Cards Layout ───────────────────────────────────────────────
export function FloatingCards({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-12 min-h-[450px] flex items-end p-6 md:p-12">
      <img src={dayImage} alt={`Day ${num}`} className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
      
      <div className="relative z-20 max-w-2xl bg-white/95 backdrop-blur-md p-6 md:p-8 rounded-2xl shadow-xl border border-white/40">
        <span className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-full inline-block mb-3">
          Day 0{num}
        </span>
        <h3 className="text-2xl md:text-3xl font-serif font-bold mb-3" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: textSec }}>{day.description || 'A remarkable day crafted around VIP access and comfort.'}</p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 11. Glass Cards Layout ──────────────────────────────────────────────────
export function GlassCards({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <GlassCard theme={theme} className="p-8 mb-8 overflow-hidden relative">
      <div className="flex flex-col md:flex-row gap-8 items-center">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-white" style={{ backgroundColor: accent }}>
              Day 0{num}
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: textSec }}>Curated Experience</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold font-serif" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
          <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'Delight in breathtaking sights and private hospitality.'}</p>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
        <div className="w-full md:w-5/12 h-64 rounded-2xl overflow-hidden shadow-lg">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
      </div>
    </GlassCard>
  );
}

// ─── 12. Bento Grid Layout ───────────────────────────────────────────────────
export function BentoGrid({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10">
      <div className="md:col-span-8 bg-white p-8 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ borderColor: theme.colors?.border }}>
        <div>
          <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-black/5 mb-3 inline-block" style={{ color: accent }}>
            Day 0{num} Chronicle
          </span>
          <h3 className="text-2xl md:text-3xl font-bold font-serif mb-4" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
          <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'A full day of extraordinary discovery and VIP comfort.'}</p>
        </div>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
      
      <div className="md:col-span-4 h-72 md:h-auto rounded-2xl overflow-hidden shadow-md relative group">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded-full">
          Featured View
        </div>
      </div>
    </div>
  );
}

// ─── 13. Polaroid Style Layout ───────────────────────────────────────────────
export function PolaroidStyle({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-10 border-b flex flex-col md:flex-row gap-10 items-center" style={{ borderColor: theme.colors?.border }}>
      <div className="w-full md:w-5/12 bg-white p-4 pb-12 rounded-lg shadow-xl border border-gray-200 transform -rotate-2 relative">
        <div className="h-64 overflow-hidden rounded mb-4">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
        <div className="text-center font-serif italic text-lg" style={{ color: primary }}>
          Day 0{num} — {day.title || 'Memories Crafted'}
        </div>
      </div>
      <div className="flex-1 space-y-4">
        <span className="text-xs uppercase tracking-widest font-semibold block" style={{ color: accent }}>Travel Snapshot</span>
        <h3 className="text-3xl font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'Capture the spirit of adventure with private guides and unforgettable scenery.'}</p>
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 14. Luxury Card Stack Layout ────────────────────────────────────────────
export function LuxuryCardStack({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-10 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="relative max-w-5xl mx-auto">
        <div className="h-80 rounded-3xl overflow-hidden shadow-xl">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
        <div className="md:-mt-20 mx-4 md:mx-12 relative z-10 bg-white p-8 md:p-10 rounded-2xl shadow-2xl border" style={{ borderColor: theme.colors?.border }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-[0.25em] font-bold" style={{ color: accent }}>Day 0{num} Itinerary</span>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-black/5">VIP Access</span>
          </div>
          <h3 className="text-3xl font-serif font-bold mb-4" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
          <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'Experience premier luxury and exclusive access to cultural icons.'}</p>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
      </div>
    </div>
  );
}

// ─── 15. Alternating Layout ──────────────────────────────────────────────────
export function AlternatingLayout({ day, dayImage, theme, index }) {
  const isEven = index % 2 === 1;
  return isEven ? RightImage({ day, dayImage, theme, index }) : LeftImage({ day, dayImage, theme, index });
}

// ─── 16. Full Bleed Image Layout ─────────────────────────────────────────────
export function FullBleedImage({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const num = day.day || index + 1;

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-12 min-h-[500px] flex flex-col justify-end p-8 md:p-16 text-white">
      <img src={dayImage} alt={`Day ${num}`} className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
      <div className="relative z-20 max-w-3xl">
        <span className="text-xs uppercase tracking-widest font-semibold px-3 py-1 bg-white/20 backdrop-blur-md rounded-full inline-block mb-4">
          Day 0{num} Expedition
        </span>
        <h3 className="text-4xl md:text-5xl font-serif font-bold mb-4 leading-tight" style={{ fontFamily: theme.typography?.headline }}>
          {day.title || `Day ${num}`}
        </h3>
        <p className="text-base md:text-lg text-white/90 leading-relaxed font-light">
          {day.description || 'An immersive day surrounded by dramatic vistas and personalized luxury.'}
        </p>
        <ActivityTags activities={day.activities} accentColor="#fbbf24" day={day} theme={theme} />
      </div>
    </div>
  );
}

// ─── 17. Hero Image Gallery Layout ───────────────────────────────────────────
export function HeroImageGallery({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-8 border-b space-y-6" style={{ borderColor: theme.colors?.border }}>
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs uppercase tracking-widest font-semibold block" style={{ color: accent }}>Day 0{num}</span>
          <h3 className="text-3xl font-serif font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
        </div>
        <span className="text-sm font-mono opacity-60">Chronicle</span>
      </div>
      <div className="h-80 rounded-2xl overflow-hidden shadow-xl">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
      </div>
      <p className="text-base leading-relaxed" style={{ color: textSec }}>{day.description || 'Spend the day exploring iconic landmarks and cultural treasures.'}</p>
      <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
    </div>
  );
}

// ─── 18. Two Column Editorial Layout ─────────────────────────────────────────
export function TwoColumnEditorial({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-10 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="mb-6">
        <span className="text-xs uppercase tracking-[0.25em] font-semibold block text-gray-400">Day 0{num}</span>
        <h3 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <p className="text-base leading-relaxed font-serif" style={{ color: textSec }}>
            {day.description || 'An inspiring journey designed for those who appreciate fine hospitality and authentic local encounters.'}
          </p>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
        <div className="h-64 rounded-xl overflow-hidden shadow-lg">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

// ─── 19. Three Column Magazine Layout ────────────────────────────────────────
export function ThreeColumnMagazine({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-10 border-b" style={{ borderColor: theme.colors?.border }}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-3">
          <span className="text-5xl font-serif font-bold opacity-30 block" style={{ color: accent }}>0{num}</span>
          <h4 className="text-xl font-bold mt-2" style={{ color: primary }}>{day.title || `Day ${num}`}</h4>
        </div>
        <div className="md:col-span-5">
          <p className="text-sm md:text-base leading-relaxed" style={{ color: textSec }}>
            {day.description || 'Spend the day discovering hidden gems and enjoying VIP treatment.'}
          </p>
          <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
        </div>
        <div className="md:col-span-4 h-52 rounded-xl overflow-hidden shadow">
          <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

// ─── 20. Storybook Layout ────────────────────────────────────────────────────
export function StorybookLayout({ day, dayImage, theme, index }) {
  const primary = theme.colors?.primary || '#1a1a2e';
  const accent = theme.colors?.accent || '#c41e3a';
  const textSec = theme.colors?.textSecondary || '#64748b';
  const num = day.day || index + 1;

  return (
    <div className="py-12 border-b text-center max-w-4xl mx-auto" style={{ borderColor: theme.colors?.border }}>
      <span className="text-xs uppercase tracking-[0.3em] font-semibold block mb-2" style={{ color: accent }}>Chapter 0{num}</span>
      <h3 className="text-3xl md:text-5xl font-serif font-bold mb-6" style={{ color: primary, fontFamily: theme.typography?.headline }}>{day.title || `Day ${num}`}</h3>
      <div className="w-full h-72 rounded-2xl overflow-hidden shadow-xl mb-8 mx-auto">
        <img src={dayImage} alt={`Day ${num}`} className="w-full h-full object-cover" />
      </div>
      <p className="text-base md:text-lg leading-relaxed font-serif italic max-w-2xl mx-auto mb-6" style={{ color: textSec }}>
        "{day.description || 'An enchanting narrative unfolds as you explore scenic landscapes and historical monuments.'}"
      </p>
      <div className="flex justify-center">
        <ActivityTags activities={day.activities} accentColor={accent} day={day} theme={theme} />
      </div>
    </div>
  );
}
