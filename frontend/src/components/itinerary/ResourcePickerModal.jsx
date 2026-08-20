import { useState, useEffect, useCallback } from 'react';
import { hotelsService, activitiesService, flightsService } from '../../services/resourceService.js';
import { isLocationMatch } from '../../lib/destinationHierarchy.js';

export default function ResourcePickerModal({ type, onSelect, onClose, destination, subDestination }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const cleanPrice = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const loadData = useCallback(() => {
    // 1. Instant local load (sub-second response)
    let localData = [];
    try {
      const stored = localStorage.getItem('voyanta_unified_library');
      if (stored) {
        const parsed = JSON.parse(stored);
        const targetType = type === 'hotel' ? 'hotel' : type === 'activity' ? 'activity' : 'flight';
        localData = parsed.filter(item => item.type === targetType).map(item => ({
          ...item,
          image_url: item.cover_image || item.image_url || '',
          cover_image: item.cover_image || item.image_url || ''
        }));
      }
    } catch (err) {}

    let initialFiltered = localData;
    if (destination || subDestination) {
      initialFiltered = initialFiltered.filter(item => isLocationMatch(item, destination, subDestination));
    }
    setItems(initialFiltered);
    setLoading(false);

    // 2. Async background sync to fetch from DB and merge
    const syncData = async () => {
      try {
        let dbData = [];
        if (type === 'hotel') dbData = await hotelsService.list();
        else if (type === 'activity') dbData = await activitiesService.list();
        else if (type === 'flight') dbData = await flightsService.list();

        // Also query knowledge_objects
        if ((destination || subDestination) && (type === 'hotel' || type === 'activity')) {
          try {
            const supa = (await import('../../lib/supabaseClient.js')).supabase;
            if (supa) {
              const { data: dbObjects } = await supa
                .from('knowledge_objects')
                .select('*')
                .eq('object_type', type)
                .eq('is_active', true)
                .limit(100);

              if (dbObjects && dbObjects.length > 0) {
                const mappedObjects = dbObjects.map(obj => {
                  const attrs = obj.attributes || {};
                  return {
                    id: obj.id,
                    name: obj.name,
                    location: obj.area || obj.destination || '',
                    destination: obj.destination || '',
                    area: obj.area || '',
                    image_url: attrs.photos?.[0] || attrs.image_url || '',
                    cover_image: attrs.photos?.[0] || attrs.image_url || '',
                    category: attrs.star_rating || '',
                    duration_hours: attrs.duration || '',
                    price: cleanPrice(attrs.price || attrs.price_per_night || attrs.cost || 0),
                    price_per_night: cleanPrice(attrs.price_per_night || attrs.price || 0),
                    is_from_vault: true
                  };
                });
                dbData = [...dbData, ...mappedObjects];
              }
            }
          } catch (e) {}
        }

        if (dbData.length > 0) {
          // Merge with localData
          const seen = new Set(localData.map(i => String(i.id)));
          const merged = [...localData];
          dbData.forEach(item => {
            if (!seen.has(String(item.id))) {
              merged.push(item);
              seen.add(String(item.id));
            }
          });
          
          let finalFiltered = merged;
          if (destination || subDestination) {
            finalFiltered = finalFiltered.filter(item => isLocationMatch(item, destination, subDestination));
          }
          setItems(finalFiltered);
        }
      } catch (err) {}
    };
    syncData();
  }, [type, destination, subDestination]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = (item) => {
    let blockData = {};
    if (type === 'hotel') {
      blockData = {
        name: item.name,
        details: `${item.location || ''} ${item.category ? `· ${item.category}` : ''}`,
        image_url: item.cover_image || item.image_url || '',
        rawItem: item
      };
    } else if (type === 'activity') {
      blockData = {
        name: item.name,
        details: `${item.location || ''} ${item.duration_hours ? `· ${item.duration_hours}h` : ''}`,
        image_url: item.image_url || '',
        rawItem: item
      };
    } else if (type === 'flight') {
      blockData = {
        name: `${item.airline} ${item.flight_no || ''}`,
        details: `${item.origin || ''} to ${item.destination || ''} · ${item.class || ''}`,
        image_url: '',
        rawItem: item
      };
    }
    onSelect(blockData);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h3 className="font-headline-sm text-xl font-bold text-on-surface capitalize">Select {type}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-lg bg-surface custom-scrollbar">
          {loading ? (
            <div className="text-center py-xl text-on-surface-variant">Loading {type}s...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-xl text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
              No {type}s found in your library.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              {items.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-md p-md rounded-xl border border-outline-variant bg-white hover:border-primary hover:shadow-md cursor-pointer transition-all group"
                >
                  <div className="w-16 h-16 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.cover_image || item.image_url ? (
                      <img src={item.cover_image || item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="material-symbols-outlined text-[24px] text-on-surface-variant/50">
                        {type === 'hotel' ? 'hotel' : type === 'activity' ? 'local_activity' : type === 'flight' ? 'flight' : 'image'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                      {item.name || `${item.airline} ${item.flight_no || ''}`}
                    </h4>
                    <p className="text-xs text-on-surface-variant truncate">
                      {type === 'hotel' ? item.location : type === 'activity' ? item.location : `${item.origin} - ${item.destination}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-md border-t border-outline-variant bg-surface-container-lowest flex justify-end">
          <button onClick={() => onSelect({ name: '', details: '', image_url: '' })} className="px-md py-sm bg-surface-variant text-on-surface-variant font-bold rounded-lg hover:bg-surface-container-high transition-colors">
            Create Blank {type}
          </button>
        </div>
      </div>
    </div>
  );
}
