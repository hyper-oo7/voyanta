import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadOrEmbed } from '../LogoUploader.jsx';
import ImageSearchPicker from '../common/ImageSearchPicker.jsx';

export default function SortableContentBlock({ id, item, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showStockPicker, setShowStockPicker] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOrEmbed(file, 'itinerary-blocks');
      if (item.type === 'image') {
        onChange(id, { url });
      } else {
        onChange(id, { ...item.data, image_url: url });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const getIconAndLabel = () => {
    switch (item.type) {
      case 'heading':
        return { icon: 'title', label: 'Heading', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'text':
        return { icon: 'notes', label: 'Text Block', color: 'text-gray-600 bg-gray-50 border-gray-200' };
      case 'image':
        return { icon: 'image', label: 'Image', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'gallery':
        return { icon: 'photo_library', label: 'Gallery', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      case 'hotel':
        return { icon: 'hotel', label: 'Hotel', color: 'text-amber-600 bg-amber-50 border-amber-200' };
      case 'activity':
        return { icon: 'local_activity', label: 'Activity', color: 'text-rose-600 bg-rose-50 border-rose-200' };
      case 'flight':
        return { icon: 'flight', label: 'Flight', color: 'text-sky-600 bg-sky-50 border-sky-200' };
      case 'transfer':
        return { icon: 'directions_car', label: 'Transfer', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
      case 'meals':
        return { icon: 'restaurant', label: 'Meals', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 'cruise':
        return { icon: 'directions_boat', label: 'Cruise / Ferry', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' };
      case 'destination':
        return { icon: 'location_on', label: 'Destination Overview', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
      case 'custom':
        return { icon: 'dashboard', label: 'Custom Card', color: 'text-violet-600 bg-violet-50 border-violet-200' };
      default:
        return { icon: 'widgets', label: 'Block', color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  const info = getIconAndLabel();

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`group relative flex gap-4 p-4 rounded-xl border border-outline-variant bg-white hover:border-primary/30 hover:shadow-sm transition-all duration-200 mb-3 ${isDragging ? 'opacity-50 shadow-lg border-primary bg-primary/5' : ''}`}
    >
      {/* Drag Handle & Icon Container */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 select-none">
        <div 
          {...attributes} 
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-on-surface-variant/40 hover:text-on-surface-variant transition-opacity"
        >
          <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${info.color} shadow-sm border`}>
          <span className="material-symbols-outlined text-[18px]">{info.icon}</span>
        </div>
      </div>
      
      {/* Block Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1.5 select-none">{info.label}</div>
        
        {item.type === 'heading' && (
          <input 
            type="text" 
            value={item.data.text || ''} 
            onChange={(e) => onChange(id, { text: e.target.value })}
            placeholder="Heading..."
            className="w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface placeholder:text-on-surface-variant/30"
          />
        )}
        
        {item.type === 'text' && (
          <textarea 
            value={item.data.text || ''} 
            onChange={(e) => onChange(id, { text: e.target.value })}
            placeholder="Type text here..."
            className="w-full text-base bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface resize-none min-h-[1.5em] placeholder:text-on-surface-variant/30"
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ height: item.data.text ? 'auto' : '1.5em' }}
          />
        )}
        
        {(item.type === 'hotel' || item.type === 'activity' || item.type === 'flight' || item.type === 'transfer' || item.type === 'meals' || item.type === 'cruise' || item.type === 'destination' || item.type === 'custom') && (
          <div className="flex gap-md items-stretch mt-1 group/travel">
            <div className="relative w-20 rounded-lg bg-surface-variant flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-outline-variant min-h-[60px]">
              {item.data.image_url ? (
                <img src={item.data.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant/50 text-[24px]">image</span>
              )}
              <div 
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/travel:opacity-100 cursor-pointer transition-opacity"
              >
                <span className="material-symbols-outlined text-white text-[20px]">{uploading ? 'hourglass_empty' : 'upload'}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <input 
                type="text" 
                value={item.data.name || ''} 
                onChange={(e) => onChange(id, { ...item.data, name: e.target.value })}
                placeholder={`${info.label} name...`}
                className="w-full text-lg font-bold bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface"
              />
              <input 
                type="text" 
                value={item.data.details || ''} 
                onChange={(e) => onChange(id, { ...item.data, details: e.target.value })}
                placeholder={
                  item.type === 'hotel' ? 'Details (e.g. check-in time, room type)...' :
                  item.type === 'flight' ? 'Details (e.g. flight number, departure time)...' :
                  item.type === 'activity' ? 'Details (e.g. start time, meeting point)...' :
                  item.type === 'transfer' ? 'Details (e.g. pick-up time, vehicle type)...' :
                  item.type === 'meals' ? 'Details (e.g. reservation time, dietary notes)...' :
                  'Details...'
                }
                className="w-full text-sm text-on-surface-variant bg-transparent border-none outline-none focus:ring-0 p-0 mt-0.5"
              />
            </div>
          </div>
        )}
        
        {item.type === 'image' && (
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-variant relative group/img mt-1">
            {showStockPicker && (
              <ImageSearchPicker
                onSelect={(url) => {
                  onChange(id, { url });
                  setShowStockPicker(false);
                }}
                onClose={() => setShowStockPicker(false)}
                defaultQuery="luxury resort"
              />
            )}
            {item.data.url ? (
              <img src={item.data.url} alt="" className="w-full max-h-96 object-cover" />
            ) : (
              <div className="w-full h-36 flex flex-col gap-2.5 items-center justify-center text-on-surface-variant font-semibold p-4">
                <span>Image Placeholder</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowStockPicker(true)}
                    className="px-3 py-1.5 bg-secondary text-on-secondary rounded-lg text-xs font-bold hover:bg-secondary/90 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">photo_library</span>
                    Stock Photos
                  </button>
                  <button 
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">upload</span>
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-2">
              <input 
                type="text" 
                value={item.data.url || ''} 
                onChange={(e) => onChange(id, { url: e.target.value })}
                placeholder="Paste Image URL..."
                className="flex-1 text-xs bg-transparent border-none outline-none text-white placeholder:text-white/50 px-1"
              />
              <button 
                type="button"
                onClick={() => setShowStockPicker(true)}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">photo_library</span>
                Stock
              </button>
              <button 
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">upload</span>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        )}

        {item.type === 'gallery' && (
          <div className="border border-outline-variant rounded-xl p-sm bg-surface-variant group/img mt-1">
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-1">Gallery (Paste URLs below, one per line)</div>
            <textarea 
                value={item.data.urls || ''} 
                onChange={(e) => onChange(id, { urls: e.target.value })}
                placeholder="https://image1.jpg&#10;https://image2.jpg"
                className="w-full text-xs bg-white border border-outline-variant rounded-lg p-2 outline-none mb-2 resize-none"
                rows={3}
            />
            {item.data.urls && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {item.data.urls.split('\n').map((url, i) => url.trim() ? (
                  <img key={i} src={url.trim()} alt="" className="w-full h-24 object-cover rounded-lg shadow-sm" />
                ) : null)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remove Button */}
      <button 
        onClick={() => onRemove(id)}
        className="opacity-0 group-hover:opacity-100 mt-2 w-6 h-6 rounded-md hover:bg-error/10 text-on-surface-variant/60 hover:text-error flex items-center justify-center transition-all flex-shrink-0"
        title="Remove block"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}
