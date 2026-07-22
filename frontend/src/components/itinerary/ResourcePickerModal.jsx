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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];
      if (type === 'hotel') {
        data = await hotelsService.list();
      } else if (type === 'activity') {
        data = await activitiesService.list();
      } else if (type === 'flight') {
        data = await flightsService.list();
      }

      // Query knowledge objects from Supabase to merge from vault dynamically
      if ((destination || subDestination) && (type === 'hotel' || type === 'activity')) {
        try {
          const supa = (await import('../../lib/supabaseClient.js')).supabase;
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
            // Merge and de-duplicate by name
            const seenNames = new Set(data.map(i => (i.name || '').toLowerCase().trim()));
            mappedObjects.forEach(mo => {
              const nameKey = mo.name.toLowerCase().trim();
              if (!seenNames.has(nameKey)) {
                data.push(mo);
                seenNames.add(nameKey);
              }
            });
          }
        } catch (dbErr) {
          console.error("Failed to query knowledge_objects in picker:", dbErr);
        }
      }

      // Filter dynamically by destination and sub-destination (area) using dynamic hierarchy engine
      if (destination || subDestination) {
        data = data.filter(item => isLocationMatch(item, destination, subDestination));
      }

      setItems(data);
    } catch (e) {
      console.error('Failed to load resources', e);
    } finally {
      setLoading(false);
    }
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
