import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { itinerariesService, itineraryBlocksService } from '../services/resourceService.js';
import LogoUploader from '../components/LogoUploader.jsx';

export default function NewItineraryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    country: '',
    state: '',
    city: '',
    duration: 3,
    theme: '',
    tags: '',
    description: '',
    cover_image: ''
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Itinerary Name is required'); return; }
    setSaving(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

      // Omit excluded_items and included_items to rely on database defaults
      // and bypass any schema cache issues during insertion
      const payload = {
        name: formData.name.trim(),
        destination: formData.destination.trim(),
        duration: formData.duration,
        description: formData.description.trim(),
        cover_image: formData.cover_image,
        
        country: formData.country.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        theme: formData.theme.trim(),
        tags: tagsArray,
      };

      const it = await itinerariesService.create(payload);
      
      const blocks = [];
      blocks.push({ itinerary_id: it.id, block_type: 'arrival', title: 'Arrival', position: 0, content: [] });
      for (let i = 1; i <= formData.duration; i++) {
        blocks.push({ itinerary_id: it.id, block_type: 'day', day_number: i, title: `Day ${i}`, position: i, content: [] });
      }
      blocks.push({ itinerary_id: it.id, block_type: 'departure', title: 'Departure', position: formData.duration + 1, content: [] });
      
      await Promise.all(blocks.map((b) => itineraryBlocksService.create(b)));
      
      toast.success('Itinerary created');
      navigate(`/itinerary/${it.id}`);
    } catch (err) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-xl space-y-xl max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-md">
        <button 
          onClick={() => navigate('/itinerary')}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="font-headline-md text-3xl font-bold text-on-surface m-0">Create New Itinerary</h2>
          <p className="font-body-lg text-on-surface-variant m-0 mt-xs">Fill in the details below to start building your itinerary.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-xl shadow-sm border border-outline-variant">
        <form onSubmit={handleCreate} className="space-y-xl">
          <LogoUploader 
            value={formData.cover_image} 
            onChange={(v) => setFormData(s => ({ ...s, cover_image: v }))} 
            label="Cover Image" 
            testid="itin-cover" 
            folder="covers" 
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <label className="flex flex-col gap-xs col-span-full">
              <span className="font-label-md text-on-surface font-semibold">Itinerary Name *</span>
              <input type="text" required value={formData.name} onChange={(e) => setFormData(s => ({ ...s, name: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Dubai Luxury 5D/4N" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Destination</span>
              <input type="text" value={formData.destination} onChange={(e) => setFormData(s => ({ ...s, destination: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Dubai" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Duration (Days)</span>
              <input type="number" min="1" max="90" value={formData.duration} onChange={(e) => setFormData(s => ({ ...s, duration: parseInt(e.target.value) || 1 }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Country</span>
              <input type="text" value={formData.country} onChange={(e) => setFormData(s => ({ ...s, country: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. United Arab Emirates" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">State / Region</span>
              <input type="text" value={formData.state} onChange={(e) => setFormData(s => ({ ...s, state: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Dubai Emirate" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">City</span>
              <input type="text" value={formData.city} onChange={(e) => setFormData(s => ({ ...s, city: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Dubai" />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-on-surface font-semibold">Theme</span>
              <input type="text" value={formData.theme} onChange={(e) => setFormData(s => ({ ...s, theme: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Honeymoon, Adventure" />
            </label>

            <label className="flex flex-col gap-xs col-span-full">
              <span className="font-label-md text-on-surface font-semibold">Tags (comma separated)</span>
              <input type="text" value={formData.tags} onChange={(e) => setFormData(s => ({ ...s, tags: e.target.value }))}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Luxury, Summer, Couple" />
            </label>

            <label className="flex flex-col gap-xs col-span-full">
              <span className="font-label-md text-on-surface font-semibold">Description</span>
              <textarea value={formData.description} onChange={(e) => setFormData(s => ({ ...s, description: e.target.value }))} rows={4}
                className="px-md py-md border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none" placeholder="Brief overview of the experience..." />
            </label>
          </div>
          
          <div className="flex justify-end gap-md pt-lg border-t border-outline-variant/50">
            <button type="button" onClick={() => navigate('/itinerary')} className="px-xl py-md border border-outline-variant text-on-surface font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-xl py-md bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-colors shadow-md disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Itinerary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
