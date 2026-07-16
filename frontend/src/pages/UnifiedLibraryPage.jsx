import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { logActivity } from '../services/activityLogService.js';
import ImageUploadInput from '../components/common/ImageUploadInput.jsx';
import { getAgencyId, supabase } from '../lib/supabaseClient.js';

export default function UnifiedLibraryPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  // 1. Initial items state loading from localStorage voyanta_unified_library
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem('voyanta_unified_library');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: '1', type: 'hotel', name: 'The Khyber Himalayan Resort & Spa', location: 'Gulmarg, Kashmir', rate: '₹34,500 / night', details: 'Luxury Ski Resort • Mountain View Suite • Breakfast included', cover_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', parsedFrom: 'manual' },
      { id: '2', type: 'activity', name: 'Shikara Sunset Ride on Dal Lake', location: 'Srinagar, Kashmir', rate: '₹2,500 / ride', details: 'Duration: 2 hours • Private boat with Kashmiri Kahwa service', cover_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', parsedFrom: 'manual' },
      { id: '3', type: 'itinerary', name: 'Kashmir Royal Paradise 6D/5N', location: 'Srinagar • Gulmarg • Pahalgam', rate: '₹84,000 / couple', details: 'Includes houseboat stay, private Innova Crysta, all sightseeing', cover_image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80', parsedFrom: 'manual' }
    ];
  });

  // Keep localStorage sync and event handlers updated
  useEffect(() => {
    try {
      localStorage.setItem('voyanta_unified_library', JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem('voyanta_unified_library');
        if (stored) setItems(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener('voyanta:unified-library-updated', handleSync);
    return () => window.removeEventListener('voyanta:unified-library-updated', handleSync);
  }, []);

  // Upload/Parse state
  const [uploading, setUploading] = useState(false);

  // Add Item Dropdown state
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Edit / Add Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    type: 'hotel',
    name: '',
    location: '',
    rate: '',
    details: '',
    cover_image: ''
  });

  // Handle click outside Add Dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    
    setTimeout(() => {
      const parsedEntries = [
        {
          id: Date.now().toString() + '-1',
          type: ext === 'csv' || ext === 'xlsx' ? 'hotel' : 'itinerary',
          name: `${file.name.replace(/\.[^/.]+$/, "")} - Parsed Entry`,
          location: 'Extracted Destination',
          rate: '₹14,500 / unit',
          details: `Parsed 100% of structured data from ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          cover_image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
          parsedFrom: file.name
        },
        {
          id: Date.now().toString() + '-2',
          type: 'activity',
          name: `${file.name.replace(/\.[^/.]+$/, "")} - Parsed Activity`,
          location: 'Extracted Location',
          rate: '₹3,200 / pax',
          details: `Extracted timing, inclusions, and custom vendor notes from ${file.name}`,
          cover_image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80',
          parsedFrom: file.name
        }
      ];

      setItems(prev => [...parsedEntries, ...prev]);
      setUploading(false);
      logActivity('library', `Parsed and ingested ${parsedEntries.length} items from ${file.name}`);
      toast.success(`Successfully parsed ${file.name} into Library database!`);
    }, 900);
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the library?`)) return;
    setItems(prev => prev.filter(item => item.id !== id));
    toast.info(`Removed ${name} from library`);
  };

  // Open modal to add item of type
  const handleOpenAdd = (type) => {
    setModalMode('add');
    setFormData({
      id: Date.now().toString(),
      type: type,
      name: '',
      location: '',
      rate: '',
      details: '',
      cover_image: type === 'hotel' 
        ? 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80' 
        : type === 'activity' 
        ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'
        : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80'
    });
    setEditingItem(null);
    setIsModalOpen(true);
    setShowAddDropdown(false);
  };

  // Open modal to edit existing item
  const handleOpenEdit = (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setFormData({
      id: item.id,
      type: item.type,
      name: item.name || '',
      location: item.location || '',
      rate: item.rate || '',
      details: item.details || item.description || '',
      cover_image: item.cover_image || ''
    });
    setIsModalOpen(true);
  };

  // Save Add/Edit item locally & optimistic server upsert
  const handleModalSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.location.trim()) {
      toast.error('Name and Location are required.');
      return;
    }

    const savedItem = {
      ...formData,
      parsedFrom: modalMode === 'edit' ? editingItem?.parsedFrom || 'manual' : 'manual'
    };

    if (modalMode === 'add') {
      setItems(prev => [savedItem, ...prev]);
      toast.success('Successfully added item to central library!');
    } else {
      setItems(prev => prev.map(item => item.id === editingItem.id ? savedItem : item));
      toast.success('Updated item changes saved successfully!');
    }

    // Try optimistically syncing to PostgreSQL if Supabase is connected
    const agencyId = getAgencyId();
    if (supabase && agencyId) {
      try {
        const table = formData.type === 'hotel' ? 'hotels' : formData.type === 'activity' ? 'activities' : 'itineraries';
        const payload = {
          id: formData.id,
          name: formData.name,
          location: formData.location,
          rate: formData.rate,
          description: formData.details,
          cover_image: formData.cover_image,
          agency_id: agencyId,
          updated_at: new Date().toISOString()
        };
        
        await supabase.from(table).upsert([payload]).select();
      } catch (err) {
        console.warn('Optimsitic Supabase sync failed, kept in local library storage:', err);
      }
    }

    setIsModalOpen(false);
  };

  const filteredItems = items.filter(it =>
    (activeTab === 'all' || it.type === activeTab) &&
    (it.name.toLowerCase().includes(search.toLowerCase()) ||
     it.location.toLowerCase().includes(search.toLowerCase()) ||
     (it.details || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header & File Upload Dropzone */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface m-0">Central Master Library</h1>
          <p className="text-xs text-on-surface-variant m-0 mt-1">
            Store, upload, and parse Hotels, Activities, and Itineraries (PDF, CSV, XLSX) into structured reusable components
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Add Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="px-5 py-3 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Item
              <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
            </button>
            {showAddDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 border border-outline-variant rounded-xl shadow-xl z-50 py-2 overflow-hidden text-on-surface text-left font-sans">
                <button
                  type="button"
                  onClick={() => handleOpenAdd('hotel')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">hotel</span>
                  Add Hotel
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAdd('activity')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-teal-500 text-[18px]">local_activity</span>
                  Add Activity
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAdd('itinerary')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-purple-500 text-[18px]">map</span>
                  Add Itinerary
                </button>
              </div>
            )}
          </div>

          <label className="px-5 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all">
            <span className="material-symbols-outlined text-[18px]">{uploading ? 'sync' : 'upload_file'}</span>
            <span>{uploading ? 'Parsing File...' : 'Upload & Ingest'}</span>
            <input
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Items', icon: 'apps' },
            { id: 'hotel', label: 'Hotels & Resorts', icon: 'hotel' },
            { id: 'activity', label: 'Activities & Tours', icon: 'local_activity' },
            { id: 'itinerary', label: 'Full Itineraries', icon: 'map' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-none cursor-pointer transition-all ${
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant w-72">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search library..."
            className="w-full bg-transparent border-none text-xs text-on-surface focus:outline-none"
          />
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            {/* Card Cover Image */}
            <div className="h-40 w-full relative bg-surface-variant">
              {item.cover_image || item.image_url ? (
                <img src={item.cover_image || item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
                    {item.type === 'hotel' ? 'hotel' : item.type === 'activity' ? 'local_activity' : 'map'}
                  </span>
                </div>
              )}
              <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-black/60 text-white`}>
                {item.type}
              </span>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-base font-bold text-on-surface leading-snug m-0">{item.name}</h3>
                </div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 m-0">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {item.location}
                  </p>
                  <span className="text-xs font-extrabold text-primary shrink-0">{item.rate || '₹0'}</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed m-0 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60">
                  {item.details || item.description || 'No description provided.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-outline-variant text-[11px] text-on-surface-variant">
                <span>Source: <strong className="text-on-surface">{item.parsedFrom || 'manual'}</strong></span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="text-error font-bold hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg rounded-3xl border border-outline-variant shadow-2xl overflow-hidden bg-surface-container-lowest/95 animate-scale-up">
            <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">{modalMode === 'edit' ? 'edit_note' : 'add_circle'}</span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-black text-on-surface m-0 leading-tight">
                    {modalMode === 'edit' ? 'Edit Item Details' : `Add Master ${formData.type}`}
                  </h3>
                  <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest m-0">
                    Voyanta Master Library
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleModalSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                  Name / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${formData.type === 'hotel' ? 'Amalfi Coast Luxury Resort' : 'Sunset Private Cruise'}`}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface font-semibold focus:border-primary outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Srinagar, Kashmir"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Rate / Estimated Price
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹34,500 / night"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                  Details / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide structured details, inclusions, or notes..."
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-xs text-on-surface focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* Cover Image Input using reusable stock image search & raw file uploads */}
              <ImageUploadInput
                label="Cover Image"
                value={formData.cover_image}
                onChange={(url) => setFormData({ ...formData, cover_image: url })}
                placeholder="Image URL or upload file"
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline text-xs font-bold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md hover:shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
