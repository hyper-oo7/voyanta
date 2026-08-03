import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { logActivity } from '../services/activityLogService.js';
import ImageUploadInput from '../components/common/ImageUploadInput.jsx';
import { getAgencyId, supabase } from '../lib/supabaseClient.js';
import { parseFile, suggestMapping } from '../services/parserService.js';

function mapRowToLibraryItem(row, columns, mapping, fileName, index) {
  const getVal = (targetField, altKeys) => {
    // 1. Direct suggested mapping
    for (const [col, target] of Object.entries(mapping)) {
      if (target === targetField && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
        return String(row[col]).trim();
      }
    }
    // 2. Fuzzy match on column names
    for (const key of Object.keys(row)) {
      const kLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (altKeys.some(alt => kLower.includes(alt)) && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const categoryRaw = (getVal('type', ['category', 'type', 'kind', 'item_type', 'genre']) || '').toLowerCase();
  const nameRaw = getVal('name', ['hotel', 'property', 'resort', 'activity', 'attraction', 'site', 'tour', 'monument', 'title', 'name', 'spot', 'landmark']) || row[columns[0]] || `Item ${index + 1}`;
  const nameLower = nameRaw.toLowerCase();

  // Determine Type (hotel | activity | attraction)
  let itemType = 'hotel';
  if (categoryRaw.includes('attract') || nameLower.includes('monument') || nameLower.includes('fort') || nameLower.includes('temple') || nameLower.includes('palace') || nameLower.includes('museum') || nameLower.includes('lake') || nameLower.includes('garden') || nameLower.includes('viewpoint') || nameLower.includes('spot') || nameLower.includes('ghat') || nameLower.includes('gondola') || nameLower.includes('falls')) {
    itemType = 'attraction';
  } else if (categoryRaw.includes('activ') || categoryRaw.includes('tour') || nameLower.includes('tour') || nameLower.includes('ride') || nameLower.includes('safari') || nameLower.includes('trek') || nameLower.includes('cruise') || nameLower.includes('rafting') || nameLower.includes('paragliding') || nameLower.includes('boating') || nameLower.includes('experience') || nameLower.includes('sports')) {
    itemType = 'activity';
  } else if (categoryRaw.includes('hotel') || categoryRaw.includes('stay') || categoryRaw.includes('resort') || nameLower.includes('hotel') || nameLower.includes('resort') || nameLower.includes('villa') || nameLower.includes('stay') || nameLower.includes('inn') || nameLower.includes('suites') || nameLower.includes('lodge')) {
    itemType = 'hotel';
  }

  // Extract core fields per user specifications:
  // Activity: Name, Place, Price / person, Duration
  // Attraction: Name, Location, Duration
  // Hotel: Name, Location, Price, Room Type, Meal Plan, Amenities
  const location = getVal('location', ['location', 'place', 'city', 'address', 'destination', 'area', 'venue']) || 'Destination TBD';
  const duration = getVal('duration', ['duration', 'time', 'hours', 'timing', 'length', 'visit_duration', 'recommended_time']) || (itemType === 'activity' ? '2 Hours' : itemType === 'attraction' ? '1 Hour' : '');
  const rawPrice = getVal('price', ['price_per_person', 'price_person', 'pax_price', 'price_per_night', 'price', 'rate', 'cost', 'fee', 'ticket_price', 'amount', 'entry_fee', 'tariff']);
  const roomType = getVal('room_type', ['room', 'category', 'bed', 'accommodation', 'suite']);
  const mealType = getVal('meal_type', ['meal', 'plan', 'board', 'inclusion', 'dining', 'food']);
  const amenitiesRaw = getVal('amenities', ['amenit', 'facilit', 'feature', 'spec']);
  const imageUrl = getVal('image_url', ['image', 'photo', 'picture', 'cover', 'url', 'link']);
  const description = getVal('description', ['description', 'detail', 'summary', 'overview', 'note', 'highlights', 'inclusions']);

  // Format price cleanly
  let formattedRate = '₹0';
  if (rawPrice) {
    const cleanNumStr = String(rawPrice).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanNumStr);
    if (!isNaN(num) && num > 0) {
      if (itemType === 'hotel') {
        formattedRate = `₹${Math.round(num).toLocaleString('en-IN')} / night`;
      } else if (itemType === 'activity') {
        formattedRate = `₹${Math.round(num).toLocaleString('en-IN')} / person`;
      } else {
        formattedRate = `₹${Math.round(num).toLocaleString('en-IN')}`;
      }
    } else {
      formattedRate = rawPrice;
    }
  } else if (itemType === 'attraction') {
    formattedRate = 'Free Entry';
  }

  // Extract all remaining extra columns as extra_fields array
  const mainKeys = ['name', 'location', 'place', 'price', 'rate', 'cost', 'duration', 'time', 'room_type', 'meal_type', 'amenities', 'image_url', 'description', 'type', 'category'];
  const extraFields = [];
  for (const col of Object.keys(row)) {
    const valStr = String(row[col] || '').trim();
    const colLower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (valStr && !mainKeys.some(k => colLower.includes(k))) {
      extraFields.push({ label: col, value: valStr });
    }
  }

  // Amenities list
  let amenitiesList = [];
  if (Array.isArray(amenitiesRaw)) {
    amenitiesList = amenitiesRaw.map(s => String(s).trim());
  } else if (amenitiesRaw) {
    amenitiesList = String(amenitiesRaw).split(/[,;•|]/).map(s => s.trim()).filter(Boolean);
  }

  return {
    id: `parsed_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
    type: itemType, // 'hotel' | 'activity' | 'attraction'
    name: nameRaw,
    place: location,
    location,
    rate: formattedRate,
    duration,
    room_type: roomType,
    meal_type: mealType,
    amenities: amenitiesList,
    details: description || `${itemType.toUpperCase()} • ${location}`,
    extra_fields: extraFields,
    cover_image: imageUrl || (
      itemType === 'hotel' 
        ? 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80' 
        : itemType === 'activity' 
          ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' 
          : 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'
    ),
    parsedFrom: fileName
  };
}

export default function UnifiedLibraryPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'hotel' | 'activity' | 'attraction'
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // Default to List View as requested
  const [isDragging, setIsDragging] = useState(false);

  // 1. Initial items state loading from localStorage voyanta_unified_library
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem('voyanta_unified_library');
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter(item => item && (item.type === 'hotel' || item.type === 'activity' || item.type === 'attraction'));
        if (filtered.length > 0) return filtered;
      }
    } catch {}
    return [
      { 
        id: '1', 
        type: 'hotel', 
        name: 'The Khyber Himalayan Resort & Spa', 
        location: 'Gulmarg, Kashmir', 
        place: 'Gulmarg, Kashmir', 
        rate: '₹34,500 / night', 
        duration: '', 
        room_type: 'Mountain View Luxury Suite', 
        meal_type: 'CP (Breakfast Included)', 
        amenities: ['WiFi', 'Ski Access', 'Indoor Heated Pool', 'Spa'], 
        details: 'Luxury Ski Resort • Mountain View Suite • Breakfast included', 
        extra_fields: [
          { label: 'Check-in Time', value: '02:00 PM' },
          { label: 'Check-out Time', value: '11:00 AM' },
          { label: 'Cancellation Policy', value: 'Free cancellation up to 72 hours prior' }
        ], 
        cover_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', 
        parsedFrom: 'manual' 
      },
      { 
        id: '2', 
        type: 'activity', 
        name: 'Shikara Sunset Ride on Dal Lake', 
        location: 'Srinagar, Kashmir', 
        place: 'Srinagar, Kashmir', 
        rate: '₹2,500 / person', 
        duration: '2 Hours', 
        room_type: '', 
        meal_type: '', 
        amenities: [], 
        details: 'Duration: 2 hours • Private boat with Kashmiri Kahwa service', 
        extra_fields: [
          { label: 'Inclusions', value: 'Private Shikara, Kashmiri Kahwa Tea, Life Jackets' },
          { label: 'Meeting Point', value: 'Ghat No. 1, Boulevard Road, Srinagar' },
          { label: 'Best Timing', value: '5:00 PM - 7:00 PM (Sunset view)' }
        ], 
        cover_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', 
        parsedFrom: 'manual' 
      },
      { 
        id: '3', 
        type: 'attraction', 
        name: 'Gulmarg Gondola Cable Car (Phase 1 & 2)', 
        location: 'Gulmarg, Kashmir', 
        place: 'Gulmarg, Kashmir', 
        rate: '₹1,450 / ticket', 
        duration: '3 Hours', 
        room_type: '', 
        meal_type: '', 
        amenities: [], 
        details: 'Highest cable car in Asia • Phase 1 (Kongdoori) & Phase 2 (Apharwat Peak)', 
        extra_fields: [
          { label: 'Operating Hours', value: '10:00 AM - 04:30 PM (Subject to weather)' },
          { label: 'Altitude', value: '14,000 feet above sea level' },
          { label: 'Important Note', value: 'Government ID required for ticket verification at boarding gate' }
        ], 
        cover_image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&q=80', 
        parsedFrom: 'manual' 
      }
    ];
  });

  // Keep localStorage sync and event handlers updated
  useEffect(() => {
    try {
      const sanitized = items.filter(it => it && (it.type === 'hotel' || it.type === 'activity' || it.type === 'attraction'));
      localStorage.setItem('voyanta_unified_library', JSON.stringify(sanitized));
    } catch {}
  }, [items]);

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem('voyanta_unified_library');
        if (stored) {
          const parsed = JSON.parse(stored);
          setItems(parsed.filter(it => it && (it.type === 'hotel' || it.type === 'activity' || it.type === 'attraction')));
        }
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

  // Edit / Add Small Detail Window Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [extraFieldsForm, setExtraFieldsForm] = useState([]);
  const [formData, setFormData] = useState({
    id: '',
    type: 'hotel',
    name: '',
    location: '',
    place: '',
    rate: '',
    duration: '',
    room_type: '',
    meal_type: '',
    amenities: '',
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

  const processUploadedFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const parsedResult = await parseFile(file);
      let parsedEntries = [];

      if (parsedResult && parsedResult.rows && parsedResult.rows.length > 0) {
        const { columns, rows } = parsedResult;
        const mapping = suggestMapping('hotels', columns, rows);
        parsedEntries = rows.map((row, idx) => mapRowToLibraryItem(row, columns, mapping, file.name, idx));
      } else if (parsedResult && (parsedResult.hotels?.length > 0 || parsedResult.activities?.length > 0)) {
        const pdfHotels = (parsedResult.hotels || []).map((h, idx) => ({
          id: `pdf_h_${Date.now()}_${idx}`,
          type: 'hotel',
          name: h.name || 'Extracted Hotel',
          location: h.location || parsedResult.destination || 'Destination TBD',
          place: h.location || parsedResult.destination || 'Destination TBD',
          rate: h.rate || (h.price_per_night ? `₹${Number(h.price_per_night).toLocaleString('en-IN')} / night` : '₹14,500 / night'),
          duration: '',
          room_type: h.room_type || 'Standard Room',
          meal_type: h.meal_type || h.meal_plan || 'CP (Breakfast)',
          amenities: Array.isArray(h.amenities) ? h.amenities : (h.amenities ? String(h.amenities).split(',') : []),
          details: h.details || h.description || `Parsed from ${file.name}`,
          extra_fields: [],
          cover_image: h.cover_image || h.image_url || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
          parsedFrom: file.name
        }));

        const pdfActivities = (parsedResult.activities || []).map((act, idx) => ({
          id: `pdf_act_${Date.now()}_${idx}`,
          type: 'activity',
          name: act.name || 'Extracted Activity',
          location: act.location || parsedResult.destination || 'Destination TBD',
          place: act.location || parsedResult.destination || 'Destination TBD',
          rate: act.rate || (act.price ? `₹${Number(act.price).toLocaleString('en-IN')} / person` : '₹2,500 / person'),
          duration: act.duration || '2 Hours',
          room_type: '',
          meal_type: '',
          amenities: [],
          details: act.details || act.description || `Parsed from ${file.name}`,
          extra_fields: [],
          cover_image: act.cover_image || act.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
          parsedFrom: file.name
        }));

        parsedEntries = [...pdfHotels, ...pdfActivities];
      }

      if (parsedEntries.length === 0) {
        toast.error(`Could not extract valid records from ${file.name}`);
        return;
      }

      setItems(prev => [...parsedEntries, ...prev]);
      toast.success(`Successfully parsed ${parsedEntries.length} items from ${file.name}!`);
      logActivity({
        user_name: 'Agent',
        action_type: 'vault_upload',
        title: `Ingested ${file.name} into Master Library`,
        impact_summary: `Parsed ${parsedEntries.length} items from ${file.name}`
      });
    } catch (err) {
      toast.error(err.message || `Failed to parse ${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processUploadedFile(droppedFile);
    }
  };

  // Open Small Window to Add Item
  const handleOpenAdd = (type) => {
    setModalMode('add');
    setEditingItem(null);
    setExtraFieldsForm([]);
    setFormData({
      id: Date.now().toString(),
      type,
      name: '',
      location: '',
      place: '',
      rate: type === 'hotel' ? '₹15,000 / night' : type === 'activity' ? '₹2,500 / person' : '₹500 / ticket',
      duration: type === 'activity' ? '2 Hours' : type === 'attraction' ? '1 Hour' : '',
      room_type: type === 'hotel' ? 'Deluxe Room' : '',
      meal_type: type === 'hotel' ? 'CP (Breakfast Included)' : '',
      amenities: type === 'hotel' ? 'WiFi, Swimming Pool, Air Conditioning' : '',
      details: '',
      cover_image: type === 'hotel' 
        ? 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80' 
        : type === 'activity'
          ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'
          : 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80'
    });
    setShowAddDropdown(false);
    setIsModalOpen(true);
  };

  // Open Small Window to View & Edit Item
  const handleOpenEdit = (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setExtraFieldsForm(Array.isArray(item.extra_fields) ? [...item.extra_fields] : []);
    setFormData({
      ...item,
      location: item.location || item.place || '',
      place: item.place || item.location || '',
      duration: item.duration || '',
      room_type: item.room_type || '',
      meal_type: item.meal_type || '',
      amenities: Array.isArray(item.amenities) ? item.amenities.join(', ') : (item.amenities || ''),
      details: item.details || item.description || ''
    });
    setIsModalOpen(true);
  };

  const handleAddExtraField = () => {
    setExtraFieldsForm(prev => [...prev, { label: '', value: '' }]);
  };

  const handleUpdateExtraField = (index, fieldKey, val) => {
    setExtraFieldsForm(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [fieldKey]: val };
      return updated;
    });
  };

  const handleRemoveExtraField = (index) => {
    setExtraFieldsForm(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteItem = (id) => {
    if (confirm('Are you sure you want to remove this item from the Master Library?')) {
      setItems(prev => prev.filter(it => it.id !== id));
      toast.success('Item removed from Library');
    }
  };

  // Save Add/Edit item locally
  const handleModalSave = (e) => {
    e.preventDefault();
    const targetLoc = formData.location || formData.place;
    if (!formData.name || !targetLoc) {
      toast.error('Name and Location/Place are required');
      return;
    }

    const processedAmenities = typeof formData.amenities === 'string'
      ? formData.amenities.split(/[,;]/).map(s => s.trim()).filter(Boolean)
      : (Array.isArray(formData.amenities) ? formData.amenities : []);

    const cleanedExtraFields = extraFieldsForm.filter(f => f.label && f.label.trim());

    const savedItem = {
      ...formData,
      location: targetLoc,
      place: targetLoc,
      amenities: processedAmenities,
      extra_fields: cleanedExtraFields
    };

    if (modalMode === 'add') {
      const newItem = { ...savedItem, parsedFrom: 'manual' };
      setItems(prev => [newItem, ...prev]);
      toast.success(`Added new ${formData.type} to Master Library`);
    } else {
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...savedItem } : it));
      toast.success(`Updated ${formData.name}`);
    }

    setIsModalOpen(false);
  };

  const filteredItems = items.filter(it =>
    it && (it.type === 'hotel' || it.type === 'activity' || it.type === 'attraction') &&
    (activeTab === 'all' || it.type === activeTab) &&
    (it.name.toLowerCase().includes(search.toLowerCase()) ||
     (it.location || '').toLowerCase().includes(search.toLowerCase()) ||
     (it.place || '').toLowerCase().includes(search.toLowerCase()) ||
     (it.details || '').toLowerCase().includes(search.toLowerCase()) ||
     (it.room_type || '').toLowerCase().includes(search.toLowerCase()) ||
     (it.meal_type || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-6 relative transition-all rounded-3xl ${isDragging ? 'ring-4 ring-primary bg-primary/5 p-4' : ''}`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-primary/10 backdrop-blur-xs rounded-3xl border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <div className="bg-surface p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-primary animate-bounce">upload_file</span>
            <div>
              <p className="font-bold text-sm text-on-surface m-0">Drop file to auto-parse & import</p>
              <p className="text-xs text-on-surface-variant m-0">CSV, XLSX, XLS, or PDF files supported</p>
            </div>
          </div>
        </div>
      )}

      {/* Header & File Upload Dropzone */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface m-0">Central Master Library</h1>
          <p className="text-xs text-on-surface-variant m-0 mt-1">
            Drag & drop supplier files (CSV, XLSX, PDF) to auto-extract Hotels, Activities, and Attractions
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
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-800 border border-outline-variant rounded-xl shadow-xl z-50 py-2 overflow-hidden text-on-surface text-left font-sans">
                <button
                  type="button"
                  onClick={() => handleOpenAdd('hotel')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">hotel</span>
                  Add Hotel & Resort
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAdd('activity')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-teal-500 text-[18px]">local_activity</span>
                  Add Activity & Tour
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAdd('attraction')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low transition-colors text-left border-none bg-transparent cursor-pointer font-bold text-xs text-on-surface"
                >
                  <span className="material-symbols-outlined text-indigo-500 text-[18px]">account_balance</span>
                  Add Attraction & Site
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

      {/* Tabs, Search & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Items', icon: 'apps' },
            { id: 'hotel', label: 'Hotels & Resorts', icon: 'hotel' },
            { id: 'activity', label: 'Activities & Tours', icon: 'local_activity' },
            { id: 'attraction', label: 'Attractions & Sites', icon: 'account_balance' },
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant w-64 md:w-72">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search library..."
              className="w-full bg-transparent border-none text-xs text-on-surface focus:outline-none"
            />
          </div>

          {/* View Mode Toggle: List View (Default) vs Box / Grid View */}
          <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden bg-surface p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border-none cursor-pointer transition-all ${
                viewMode === 'list' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Box View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border-none cursor-pointer transition-all ${
                viewMode === 'grid' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              Box View
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">library_books</span>
          <p className="text-sm font-bold text-on-surface">No library items found</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Drag & drop a supplier CSV, Excel, or PDF file anywhere here or click "Upload & Ingest".
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View Table */
        <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant w-14">Cover</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Name</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Category</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Place / Location</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Price / Rate</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Duration</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Room / Meal</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Source</th>
                <th className="py-3 px-4 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredItems.map(item => {
                const isHotel = item.type === 'hotel';
                const isActivity = item.type === 'activity';
                const isAttraction = item.type === 'attraction';

                return (
                  <tr key={item.id} className="hover:bg-surface-container-lowest/80 transition-colors group">
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        title="Click to open detail window"
                        className="w-12 h-12 rounded-xl bg-surface-variant overflow-hidden border border-outline-variant shrink-0 block cursor-pointer p-0 text-left"
                      >
                        {item.cover_image || item.image_url ? (
                          <img src={item.cover_image || item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800">
                            <span className="material-symbols-outlined text-lg text-on-surface-variant/50">
                              {isHotel ? 'hotel' : isActivity ? 'local_activity' : 'account_balance'}
                            </span>
                          </div>
                        )}
                      </button>
                    </td>

                    {/* CLICKABLE ITEM NAME: Opens Small Detail Window */}
                    <td className="py-3 px-4 max-w-xs">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Click to open detail window & extra info"
                        className="font-display text-sm font-bold text-primary hover:underline text-left bg-transparent border-none p-0 cursor-pointer block leading-snug"
                      >
                        {item.name}
                      </button>
                      <p className="text-[11px] text-on-surface-variant m-0 mt-0.5 line-clamp-1 leading-relaxed">
                        {item.details || item.description || 'No description provided.'}
                      </p>
                    </td>

                    {/* CATEGORY BADGE */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isHotel 
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                          : isActivity
                            ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}>
                        <span className="material-symbols-outlined text-[13px]">
                          {isHotel ? 'hotel' : isActivity ? 'local_activity' : 'account_balance'}
                        </span>
                        {isHotel ? 'Hotel' : isActivity ? 'Activity' : 'Attraction'}
                      </span>
                    </td>

                    {/* PLACE / LOCATION */}
                    <td className="py-3 px-4 text-xs font-semibold text-on-surface-variant whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                        {item.place || item.location || 'Destination TBD'}
                      </span>
                    </td>

                    {/* PRICE / RATE */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs font-extrabold text-primary">{item.rate || '₹0'}</span>
                    </td>

                    {/* DURATION (For Activity & Attraction) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.duration ? (
                        <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-[11px] font-semibold border border-outline-variant/50 inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-on-surface-variant">schedule</span>
                          {item.duration}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/40 text-xs">—</span>
                      )}
                    </td>

                    {/* ROOM / MEAL (For Hotel) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isHotel && (item.room_type || item.meal_type) ? (
                        <div className="flex flex-col gap-0.5">
                          {item.room_type && <span className="text-xs font-semibold text-on-surface">{item.room_type}</span>}
                          {item.meal_type && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{item.meal_type}</span>}
                        </div>
                      ) : (
                        <span className="text-on-surface-variant/40 text-xs">—</span>
                      )}
                    </td>

                    {/* SOURCE */}
                    <td className="py-3 px-4 text-xs text-on-surface-variant whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono text-[10px]">
                        {item.parsedFrom || item.source || 'manual'}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container-high text-xs font-bold text-primary bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          View / Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-error/30 hover:bg-error/10 text-xs font-bold text-error bg-transparent cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Box View Grid (Scrollable Container & Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 pb-4 custom-scrollbar scroll-smooth">
          {filteredItems.map(item => {
            const isHotel = item.type === 'hotel';
            const isActivity = item.type === 'activity';
            const isAttraction = item.type === 'attraction';

            return (
              <div key={item.id} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[440px] hover:border-primary/40 group">
                {/* Card Cover Image */}
                <div className="h-40 w-full relative bg-surface-variant shrink-0 overflow-hidden">
                  {item.cover_image || item.image_url ? (
                    <img src={item.cover_image || item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800">
                      <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
                        {isHotel ? 'hotel' : isActivity ? 'local_activity' : 'account_balance'}
                      </span>
                    </div>
                  )}
                  <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isHotel 
                      ? 'bg-amber-900/80 text-amber-200' 
                      : isActivity
                        ? 'bg-teal-900/80 text-teal-200'
                        : 'bg-indigo-900/80 text-indigo-200'
                  } backdrop-blur-xs`}>
                    {item.type}
                  </span>
                </div>

                {/* Inner Card Scrollable Body */}
                <div className="p-5 flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Click to open detail window"
                        className="font-display text-base font-bold text-on-surface hover:text-primary hover:underline leading-snug m-0 text-left bg-transparent border-none cursor-pointer"
                      >
                        {item.name}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <p className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 m-0">
                        <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                        {item.place || item.location}
                      </p>
                      <span className="text-xs font-extrabold text-primary shrink-0">{item.rate || '₹0'}</span>
                    </div>

                    {item.duration && (
                      <div className="mb-2">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-semibold border border-outline-variant/40 inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-on-surface-variant">schedule</span>
                          {item.duration}
                        </span>
                      </div>
                    )}

                    {(item.room_type || item.meal_type) && (
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {item.room_type && (
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-semibold border border-outline-variant/40">
                            {item.room_type}
                          </span>
                        )}
                        {item.meal_type && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                            {item.meal_type}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-on-surface-variant leading-relaxed m-0 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60">
                      {item.details || item.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant text-[11px] text-on-surface-variant shrink-0">
                    <span>Source: <strong className="text-on-surface">{item.parsedFrom || item.source || 'manual'}</strong></span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-primary font-bold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                        View / Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-error font-bold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SMALL WINDOW (Detail & Edit Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-xl rounded-3xl border border-outline-variant shadow-2xl overflow-hidden bg-surface-container-lowest/95 animate-scale-up flex flex-col max-h-[88vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">
                    {formData.type === 'hotel' ? 'hotel' : formData.type === 'activity' ? 'local_activity' : 'account_balance'}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-black text-on-surface m-0 leading-tight">
                    {modalMode === 'edit' ? 'Item Details & Extra Info' : `Add Master ${formData.type}`}
                  </h3>
                  <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest m-0">
                    Voyanta Master Library • {formData.type.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant border-none bg-transparent cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleModalSave} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Type Switcher & Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Item Category *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface focus:border-primary outline-none"
                  >
                    <option value="hotel">Hotel & Resort</option>
                    <option value="activity">Activity & Tour</option>
                    <option value="attraction">Attraction & Site</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Item name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface font-semibold focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Location, Price & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Place / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Srinagar, Kashmir"
                    value={formData.location || formData.place || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value, place: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    {formData.type === 'activity' ? 'Price / Person' : formData.type === 'hotel' ? 'Rate / Night' : 'Ticket Rate / Entry'}
                  </label>
                  <input
                    type="text"
                    placeholder={formData.type === 'activity' ? 'e.g. ₹2,500 / person' : formData.type === 'hotel' ? 'e.g. ₹34,500 / night' : 'e.g. ₹500 / ticket'}
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Hours, Half Day"
                    value={formData.duration || ''}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Room Type & Meal Type fields (Hotels) */}
              {formData.type === 'hotel' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                      Room Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Deluxe Mountain Suite"
                      value={formData.room_type || ''}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                      Meal Plan / Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CP (Breakfast Included)"
                      value={formData.meal_type || ''}
                      onChange={(e) => setFormData({ ...formData, meal_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Amenities field */}
              {formData.type === 'hotel' && (
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                    Amenities (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WiFi, Swimming Pool, Spa, Parking, Airport Shuttle"
                    value={formData.amenities || ''}
                    onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:border-primary outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-1">
                  Summary / Overview
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide structured overview or notes..."
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-xs text-on-surface focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* Cover Image Input */}
              <ImageUploadInput
                label="Cover Image"
                value={formData.cover_image}
                onChange={(url) => setFormData({ ...formData, cover_image: url })}
                placeholder="Image URL or upload file"
              />

              {/* EXTRA EXTRACTED INFORMATION SECTION */}
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">dataset</span>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-on-surface m-0">
                      Extra Extracted Information & Metadata
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExtraField}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border-none cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add Extra Field
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant m-0">
                  Additional columns parsed from CSV/XLSX/PDF files are stored here so the main list view remains clean.
                </p>

                {extraFieldsForm.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/60 italic m-0 py-1">
                    No extra fields parsed for this item yet. Click "+ Add Extra Field" to add custom metadata.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {extraFieldsForm.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Property Name (e.g. Inclusions)"
                          value={field.label || ''}
                          onChange={(e) => handleUpdateExtraField(idx, 'label', e.target.value)}
                          className="w-1/3 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-on-surface outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. Private boat, Kahwa)"
                          value={field.value || ''}
                          onChange={(e) => handleUpdateExtraField(idx, 'value', e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraField(idx)}
                          className="p-1 text-on-surface-variant hover:text-error bg-transparent border-none cursor-pointer"
                          title="Remove field"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline text-xs font-bold hover:bg-surface-container cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer border-none"
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
