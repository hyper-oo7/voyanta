import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImageSearchPicker({ onSelect, onClose, defaultQuery = '' }) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultQuery) {
      handleSearch();
    }
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/public/images/search?query=${encodeURIComponent(query)}`);
      if (res.success) {
        setResults(res.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h2 className="text-lg font-bold font-display">Search Stock Photos</h2>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 bg-surface-container">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant">search</span>
              <input
                type="text"
                placeholder="Search Unsplash (e.g. Paris Hotel)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary px-6 rounded-lg font-bold whitespace-nowrap flex gap-2 items-center">
              {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Search'}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-surface">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2">progress_activity</span>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {results.map((img) => (
                <button
                  key={img.id}
                  onClick={() => onSelect(img.url)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-outline-variant hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                >
                  <img src={img.thumb} alt={img.author} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all text-3xl">add_circle</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-[10px] text-left opacity-0 group-hover:opacity-100 transition-opacity">
                    Photo by {img.author}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">image_search</span>
              <p>Search for high-quality stock photos to add to your proposal.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
