import React, { useRef, useState } from 'react';
import ImageSearchPicker from './ImageSearchPicker.jsx';

export default function ImageUploadInput({ value = '', onChange, placeholder = 'https://example.com/image.jpg', label, className = '', hideStockSearch = false }) {
  const fileInputRef = useRef(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof onChange === 'function') {
        onChange(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center gap-1.5">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</label>
          {label.toLowerCase().includes('cover') && (
            <span className="material-symbols-outlined text-[15px] text-primary cursor-pointer" title="Default hero/cover background image across all proposal templates when a custom proposal cover photo is not specified.">info</span>
          )}
        </div>
      )}
      {showPicker && (
        <ImageSearchPicker 
          onClose={() => setShowPicker(false)} 
          onSelect={(url) => {
            if (typeof onChange === 'function') onChange(url);
            setShowPicker(false);
          }} 
          defaultQuery="luxury travel" 
        />
      )}
      
      <div className="flex flex-col gap-2">
        <div className="relative w-full">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface focus:border-primary focus:outline-none transition-colors"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-on-surface-variant">link</span>
        </div>

        <div className={`grid ${hideStockSearch ? 'grid-cols-1' : 'grid-cols-2'} gap-2 w-full`}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {!hideStockSearch && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-full px-2 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">search</span>
              Stock Photos
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-2 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
            Upload
          </button>
        </div>
      </div>

      {value && (
        <div className="relative inline-block mt-2 border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm max-h-32">
          <img src={value} alt="Preview" className="h-24 w-auto object-cover block" />
          <button
            type="button"
            onClick={() => onChange && onChange('')}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
            title="Remove Image"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
