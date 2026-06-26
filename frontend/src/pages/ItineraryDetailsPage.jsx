import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
import { useToast } from '../context/ToastContext.jsx';
import navMap from '../lib/navMap.js';
import StitchPage from '../components/StitchPage.jsx';

export default function ItineraryDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [itinerary, setItinerary] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await itinerariesService.get(id);
        const b = await itineraryBlocksService.list({ itinerary_id: id });
        if (!active) return;
        setItinerary(data);
        // sort blocks by day_number or position
        b.sort((x, y) => (x.day_number || 0) - (y.day_number || 0));
        setBlocks(b);
      } catch (e) {
        if (active) toast.error('Failed to load itinerary: ' + e.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, toast]);

  const onEdit = () => {
    // Open the drawer or just navigate back to itinerary list with some state?
    // Actually, ItineraryPage manages the editor. We can navigate to /itinerary with state.
    navigate('/itinerary', { state: { editItineraryId: id } });
  };

  const onDuplicate = async () => {
    try {
      const copy = await itinerariesService.create({
        name: itinerary.name + ' (Copy)',
        destination: itinerary.destination,
        duration: itinerary.duration,
        description: itinerary.description,
        cover_image: itinerary.cover_image
      });
      for (const b of blocks) {
        await itineraryBlocksService.create({
          itinerary_id: copy.id,
          block_type: b.block_type,
          day_number: b.day_number,
          title: b.title,
          content: b.content,
          notes: b.notes,
          image_url: b.image_url
        });
      }
      toast.success('Itinerary duplicated');
      navigate(`/itinerary/${copy.id}`);
    } catch (e) {
      toast.error('Duplication failed');
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this itinerary?')) return;
    try {
      await itinerariesService.remove(id);
      toast.success('Itinerary deleted');
      navigate('/itinerary');
    } catch (e) {
      toast.error('Deletion failed');
    }
  };

  const onExportPdf = () => toast.info('Exporting PDF (Coming soon to this view)');
  const onExportPpt = () => toast.info('Exporting PPT (Coming soon)');

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-surface"><div className="text-primary font-bold">Loading...</div></div>;
  }

  if (!itinerary) {
    return <div className="flex items-center justify-center h-screen bg-surface"><div className="text-on-surface-variant">Itinerary not found</div></div>;
  }

  return (
    <div style={{ display: 'contents' }}>
      <StitchPage
        styleId="stitch-style-itinerary-details"
        bodyClass="bg-surface font-body-md text-on-surface"
        extraStyles={``}
        navMap={navMap}
        html={`<div id="itinerary-details-mount" class="h-full flex flex-col"></div>`}
      />
      {/* Overlay our details content over the right side of the dashboard layout */}
      <div className="absolute inset-0 pl-72 pt-16 bg-surface overflow-y-auto z-40 flex flex-col">
        {/* Hero Section */}
        <div className="relative h-72 lg:h-96 w-full flex-shrink-0 bg-surface-variant">
          {itinerary.cover_image ? (
            <img src={itinerary.cover_image} alt="" className="w-full h-full object-cover" />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-on-surface-variant bg-surface-variant">
                 <span className="material-symbols-outlined text-[64px]">map</span>
             </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-xl">
            <h1 className="text-white font-headline-lg text-headline-lg mb-xs">{itinerary.name}</h1>
            <p className="text-white/80 font-body-lg flex gap-md items-center">
              <span><span className="material-symbols-outlined align-middle mr-1 text-[18px]">location_on</span>{itinerary.destination || 'Multiple Destinations'}</span>
              <span><span className="material-symbols-outlined align-middle mr-1 text-[18px]">calendar_today</span>{itinerary.duration} Days</span>
            </p>
          </div>
          <div className="absolute top-xl right-xl flex gap-sm">
            <button onClick={() => navigate('/itinerary')} className="px-md py-sm bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-xs font-bold text-sm border border-white/20">
               <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
            </button>
            <button onClick={onEdit} className="px-md py-sm bg-primary hover:opacity-90 text-on-primary rounded-lg shadow-lg transition-colors flex items-center gap-xs font-bold text-sm">
               <span className="material-symbols-outlined text-[18px]">edit</span> Edit
            </button>
            <button onClick={onDuplicate} className="px-md py-sm bg-white/90 hover:bg-white text-primary rounded-lg shadow-lg transition-colors flex items-center gap-xs font-bold text-sm">
               <span className="material-symbols-outlined text-[18px]">content_copy</span> Duplicate
            </button>
            <button onClick={onExportPdf} className="w-10 h-10 bg-white/90 hover:bg-white text-primary rounded-full shadow-lg transition-colors flex items-center justify-center">
               <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            </button>
            <button onClick={onExportPpt} className="w-10 h-10 bg-white/90 hover:bg-white text-primary rounded-full shadow-lg transition-colors flex items-center justify-center">
               <span className="material-symbols-outlined text-[18px]">present_to_all</span>
            </button>
            <button onClick={onDelete} className="w-10 h-10 bg-white/90 hover:bg-white text-error rounded-full shadow-lg transition-colors flex items-center justify-center">
               <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 max-w-5xl mx-auto w-full p-xl flex flex-col gap-xl">
          {/* Timeline / Blocks */}
          <div className="flex flex-col gap-lg">
            {blocks.map((b, i) => (
              <div key={b.id || i} className="flex gap-lg">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white">
                    {b.block_type === 'day' ? b.day_number : (b.block_type === 'arrival' ? 'A' : 'D')}
                  </div>
                  {i < blocks.length - 1 && <div className="w-0.5 bg-surface-container-high flex-1 my-sm" />}
                </div>
                <div className="flex-1 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/50 p-xl hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-md">
                    <div>
                      <span className="inline-block px-sm py-xs bg-surface-container text-on-surface-variant rounded text-xs font-bold uppercase tracking-wider mb-sm">
                        {b.block_type === 'day' ? 'Day Itinerary' : (b.block_type === 'arrival' ? 'Arrival' : 'Departure')}
                      </span>
                      <h3 className="font-headline-sm text-primary">{b.title || `Day ${b.day_number}`}</h3>
                    </div>
                  </div>
                  
                  {b.image_url && (
                    <img src={b.image_url} alt="" className="w-full h-64 object-cover rounded-xl mb-lg" />
                  )}

                  <div className="prose prose-sm max-w-none text-on-surface mb-md">
                    {b.content ? b.content.split('\n').map((line, j) => <p key={j} className="mb-2">{line}</p>) : <p className="text-on-surface-variant italic">No description provided.</p>}
                  </div>

                  {b.notes && (
                    <div className="mt-lg p-md bg-surface-variant rounded-lg border-l-4 border-primary">
                      <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Internal Notes / Logistics</h5>
                      <p className="text-sm text-on-surface">{b.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {blocks.length === 0 && (
              <div className="text-center py-xl text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
                No days or events scheduled yet. Edit this itinerary to add days.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
