import React, { useRef } from 'react';

export default function ImageUploadInput({ value = '', onChange, placeholder = 'https://example.com/image.jpg', label, className = '' }) {
  const fileInputRef = useRef(null);

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
      {label && <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</label>}
      
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-surface-container-lowest border border-outline-variant text-on-surface focus:border-primary focus:outline-none transition-colors"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-on-surface-variant">link</span>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
            Upload Image
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
