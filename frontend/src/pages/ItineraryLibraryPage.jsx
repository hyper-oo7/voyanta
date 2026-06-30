import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
import LogoUploader from '../components/LogoUploader.jsx';

export default function ItineraryLibraryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await itinerariesService.list();
      setItineraries(list);
    } catch (e) {
      toast.error(e.message || 'Failed to load itineraries');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);


  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this itinerary?')) return;
    try {
      await itinerariesService.remove(id);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <div className="p-xl space-y-xl max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-md text-3xl font-bold text-on-surface m-0">Content Library</h2>
          <p className="font-body-lg text-on-surface-variant m-0 mt-xs">Manage your reusable travel itineraries.</p>
        </div>
        <button onClick={() => navigate('/itinerary/new')} className="px-xl py-md bg-primary text-on-primary rounded-xl flex items-center gap-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <span className="material-symbols-outlined text-[20px]">add</span> Create Itinerary
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
        {loading ? (
          <div className="col-span-full text-center py-xl text-on-surface-variant">Loading itineraries…</div>
        ) : itineraries.length === 0 ? (
          <div className="col-span-full text-center py-xl border-2 border-dashed border-outline-variant rounded-2xl bg-surface-container-lowest text-on-surface-variant">
            No itineraries found. Create one!
          </div>
        ) : itineraries.map((it) => (
          <div 
            key={it.id} 
            className="group bg-white rounded-2xl overflow-hidden border border-outline-variant shadow-sm hover:shadow-xl hover:border-primary transition-all duration-300 cursor-pointer flex flex-col"
            onClick={() => navigate(`/itinerary/${it.id}`)}
          >
            <div className="h-48 bg-slate-100 relative overflow-hidden">
              {it.cover_image ? (
                <img src={it.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant bg-surface-variant">
                  <span className="material-symbols-outlined text-[48px] opacity-50">map</span>
                </div>
              )}
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDelete(e, it.id)} 
                  title="Delete" 
                  className="w-8 h-8 rounded-full bg-white text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-on-surface shadow-sm">
                {it.duration} Days
              </div>
            </div>
            
            <div className="p-lg flex flex-col flex-1">
              <div className="flex justify-between items-start mb-sm gap-2">
                <h4 className="font-headline-sm text-lg font-bold text-on-surface line-clamp-2 leading-tight group-hover:text-primary transition-colors">{it.name}</h4>
              </div>
              
              <div className="text-sm font-semibold text-primary/80 mb-md">
                {it.destination || 'Multiple Destinations'}
              </div>
              
              <div className="flex flex-wrap gap-xs mb-lg">
                {it.theme && <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md">{it.theme}</span>}
                {it.tags?.map(t => <span key={t} className="px-2 py-1 bg-surface-variant text-on-surface-variant text-xs font-bold rounded-md">{t}</span>)}
              </div>
              
              <div className="mt-auto pt-md border-t border-outline-variant/50 flex justify-between items-center text-xs font-semibold text-on-surface-variant">
                 <div className="flex gap-md">
                    <span className="flex items-center gap-1" title="Hotels"><span className="material-symbols-outlined text-[14px]">hotel</span> -</span>
                    <span className="flex items-center gap-1" title="Activities"><span className="material-symbols-outlined text-[14px]">local_activity</span> -</span>
                 </div>
                 <span>{new Date(it.updated_at || it.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
