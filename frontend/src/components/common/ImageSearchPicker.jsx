import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CURATED_CATEGORIES = [
  { id: 'all', label: 'All Luxury Travel', icon: 'travel_explore' },
  { id: 'hotel', label: 'Hotels & Resorts', icon: 'hotel' },
  { id: 'cruise', label: 'Cruises & Yachts', icon: 'sailing' },
  { id: 'activity', label: 'Activities & Tours', icon: 'hiking' },
  { id: 'dining', label: 'Fine Dining & Wine', icon: 'restaurant' },
  { id: 'nature', label: 'Nature & Scenery', icon: 'landscape' },
  { id: 'city', label: 'Cities & Culture', icon: 'location_city' },
  { id: 'flight', label: 'Flights & Aviation', icon: 'flight' }
];

const CURATED_PHOTOS = [
  // Hotels & Resorts
  { id: 'h1', category: 'hotel', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80', author: 'Unsplash Luxury Suite', title: '5-Star Resort Villa & Pool' },
  { id: 'h2', category: 'hotel', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', author: 'Unsplash Architecture', title: 'Grand Hotel Entrance & Lounge' },
  { id: 'h3', category: 'hotel', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80', author: 'Unsplash Tropical', title: 'Overwater Bungalows & Lagoon' },
  { id: 'h4', category: 'hotel', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&q=80', author: 'Unsplash Boutique', title: 'Rooftop Infinity Pool & Bar' },
  { id: 'h5', category: 'hotel', url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80', author: 'Unsplash Hospitality', title: 'Presidential Bedroom Suite' },
  { id: 'h6', category: 'hotel', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80', author: 'Unsplash Spa', title: 'Luxury Hotel Bedroom Interior' },
  
  // Cruises & Yachts
  { id: 'c1', category: 'cruise', url: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=600&q=80', author: 'Unsplash Nautical', title: 'Private Superyacht Sailing' },
  { id: 'c2', category: 'cruise', url: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=600&q=80', author: 'Unsplash Voyage', title: 'Luxury Cruise Ship Deck' },
  { id: 'c3', category: 'cruise', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80', author: 'Unsplash Marine', title: 'Tropical Island Anchorage' },
  { id: 'c4', category: 'cruise', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80', author: 'Unsplash Polar', title: 'Expedition Cruise in Fjords' },
  
  // Activities & Tours
  { id: 'a1', category: 'activity', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&q=80', author: 'Unsplash Adventure', title: 'Hot Air Balloon Safari' },
  { id: 'a2', category: 'activity', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80', author: 'Unsplash Wildlife', title: 'African Serengeti Safari' },
  { id: 'a3', category: 'activity', url: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=600&q=80', author: 'Unsplash Trekking', title: 'Mountain Hiking & Views' },
  { id: 'a4', category: 'activity', url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80', author: 'Unsplash Diving', title: 'Scuba Diving & Coral Reef' },
  
  // Dining & Wine
  { id: 'd1', category: 'dining', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80', author: 'Unsplash Gourmet', title: 'Michelin Star Fine Dining' },
  { id: 'd2', category: 'dining', url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=600&q=80', author: 'Unsplash Culinary', title: 'Sunset Beachfront Dinner' },
  { id: 'd3', category: 'dining', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80', author: 'Unsplash Sommelier', title: 'Wine Tasting & Vineyard' },
  
  // Nature & Scenery
  { id: 'n1', category: 'nature', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80', author: 'Unsplash Scenery', title: 'Dramatic Mountain Valley' },
  { id: 'n2', category: 'nature', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80', author: 'Unsplash Wilderness', title: 'Misty Redwood Forest' },
  { id: 'n3', category: 'nature', url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=600&q=80', author: 'Unsplash Lagoon', title: 'Crystal Clear Turquiose Bay' },
  
  // Cities & Culture
  { id: 't1', category: 'city', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80', author: 'Unsplash Europe', title: 'Paris Eiffel Tower View' },
  { id: 't2', category: 'city', url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80', author: 'Unsplash Skyline', title: 'Dubai Downtown & Burj Khalifa' },
  { id: 't3', category: 'city', url: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=600&q=80', author: 'Unsplash Heritage', title: 'Amsterdam Canals at Dusk' },
  { id: 't4', category: 'city', url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80', author: 'Unsplash India', title: 'Taj Mahal & Historic Architecture' },
  
  // Flights & Aviation
  { id: 'f1', category: 'flight', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80', author: 'Unsplash Aviation', title: 'Commercial Jet over Clouds' },
  { id: 'f2', category: 'flight', url: 'https://images.unsplash.com/photo-1540339832862-474599807836?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1540339832862-474599807836?w=600&q=80', author: 'Unsplash Charter', title: 'Private Jet Cabin Interior' },
  { id: 'f3', category: 'flight', url: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?w=1200&q=80', thumb: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?w=600&q=80', author: 'Unsplash Airport', title: 'First Class Airport Lounge' }
];

export default function ImageSearchPicker({ onSelect, onClose, defaultQuery = '' }) {
  const [query, setQuery] = useState(defaultQuery);
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState(CURATED_PHOTOS);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isApiResults, setIsApiResults] = useState(false);

  // When category changes, filter curated local results (no API call)
  useEffect(() => {
    if (!isApiResults) {
      const cat = activeCategory;
      const filtered = cat === 'all' ? CURATED_PHOTOS : CURATED_PHOTOS.filter(p => p.category === cat);
      setResults(filtered);
    }
  }, [activeCategory, isApiResults]);

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      // No query — reset to local curated
      setIsApiResults(false);
      const filtered = activeCategory === 'all' ? CURATED_PHOTOS : CURATED_PHOTOS.filter(p => p.category === activeCategory);
      setResults(filtered);
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      const searchQuery = [trimmed, activeCategory !== 'all' ? activeCategory.replace('_', ' ') : ''].filter(Boolean).join(' ');
      const resp = await fetch(`/api/public/images/search?query=${encodeURIComponent(searchQuery)}`);
      if (!resp.ok) throw new Error(`API responded ${resp.status}`);

      const data = await resp.json();
      const apiResults = (data.results || []).map(img => ({
        ...img,
        title: img.title || `${trimmed} by ${img.author || 'Stock Photo'}`,
        thumb: img.thumb || img.url
      }));

      if (apiResults.length > 0) {
        setResults(apiResults);
        setIsApiResults(true);
      } else {
        // Fallback to local curated if API returns nothing
        const filtered = activeCategory === 'all'
          ? CURATED_PHOTOS.filter(p => p.title.toLowerCase().includes(trimmed.toLowerCase()) || p.category.includes(trimmed.toLowerCase()))
          : CURATED_PHOTOS.filter(p => p.category === activeCategory);
        setResults(filtered.length > 0 ? filtered : CURATED_PHOTOS);
        setIsApiResults(false);
        setApiError('No results from API – showing curated photos instead.');
      }
    } catch (err) {
      console.error('Stock photo API error:', err);
      // Graceful fallback to local curated photos
      const filtered = activeCategory === 'all' ? CURATED_PHOTOS : CURATED_PHOTOS.filter(p => p.category === activeCategory);
      setResults(filtered);
      setIsApiResults(false);
      setApiError('Could not reach photo API. Showing local library.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-surface rounded-2xl shadow-2xl border border-outline-variant w-full max-w-4xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h2 className="text-xl font-bold font-serif text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]">photo_library</span>
              Stock Photos (Unsplash & Pexels)
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Select verified, high-resolution royalty-free luxury travel photos for your proposals and itineraries.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 pt-3 pb-2 bg-surface-container border-b border-outline-variant overflow-x-auto flex gap-2 no-scrollbar">
          {CURATED_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-surface-container-lowest border-b border-outline-variant">
          <form onSubmit={handleSearchSubmit} className="flex gap-2.5">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-on-surface-variant text-[20px]">search</span>
              <input
                type="text"
                placeholder="Search Unsplash & Pexels (e.g. Maldives Resort, Paris Hotel, Private Yacht...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2 text-sm bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-all flex gap-2 items-center cursor-pointer disabled:opacity-50"
            >
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : 'Search API'}
            </button>
          </form>
        </div>

        {/* Photo Grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface">
          {/* Source / Error notice */}
          {!loading && apiError && (
            <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">info</span>
              {apiError}
            </div>
          )}
          {!loading && isApiResults && (
            <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Live results from Unsplash / Pexels API
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              <p className="text-sm font-semibold">Searching Unsplash & Pexels for real-time photos...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {results.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onSelect(img.url)}
                  className="group relative aspect-video sm:aspect-square rounded-xl overflow-hidden border border-outline-variant hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all cursor-pointer bg-surface-variant shadow-sm"
                >
                  <img src={img.thumb} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-left">
                    <span className="font-bold text-white text-xs truncate w-full">{img.title}</span>
                    <span className="text-[10px] text-white/80 font-medium">{img.author}</span>
                  </div>
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all shadow-md">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-2">
              <span className="material-symbols-outlined text-5xl opacity-40">image_search</span>
              <p className="text-base font-bold text-on-surface">No stock photos found</p>
              <p className="text-xs text-on-surface-variant">Try selecting a different category or searching a broader keyword.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
