// LogoUploader — image input that uploads to Supabase Storage (bucket: agency-assets)
// and returns a public URL. If the bucket isn't configured (RLS / 404), falls back
// to inlining the file as a base64 data URL so branding still works in dev.

import { useRef, useState } from 'react';
import { supabase, getAgencyId } from '../lib/supabaseClient.js';
import { api } from '../services/api.js';
import ImageSearchPicker from './common/ImageSearchPicker.jsx';

const BUCKET = 'agency-assets';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function LogoUploader({ value, onChange, label = 'Logo', testid = 'logo-uploader', folder = 'logos' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showStockPicker, setShowStockPicker] = useState(false);

  const onPick = () => fileRef.current?.click();
  const onClear = () => onChange('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Only image files'); return; }
    if (file.size > MAX_BYTES)           { setErr('Max 5 MB'); return; }
    setErr(''); setBusy(true);
    try {
      const url = await uploadOrEmbed(file, folder);
      onChange(url);
    } catch (e2) {
      setErr(e2.message || 'Upload failed');
    } finally { setBusy(false); }
  };

  const strVal = typeof value === 'object' && value !== null ? (value.url || value.src || JSON.stringify(value)) : String(value ?? '');

  return (
    <div className="flex flex-col gap-xs" data-testid={testid}>
      {showStockPicker && (
        <ImageSearchPicker
          onSelect={(url) => {
            onChange(url);
            setShowStockPicker(false);
          }}
          onClose={() => setShowStockPicker(false)}
          defaultQuery="luxury travel"
        />
      )}
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <div className="flex flex-col sm:flex-row sm:items-center gap-md">
        <div className="w-20 h-20 rounded-lg border border-outline-variant bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
          {strVal
            ? <img src={strVal} alt="Logo" className="max-w-full max-h-full object-contain" data-testid={`${testid}-preview`} />
            : <span className="material-symbols-outlined text-on-surface-variant text-[28px]">image</span>}
        </div>
        <div className="flex-1 flex flex-col gap-xs min-w-0 w-full">
          <div className="flex gap-xs flex-wrap items-center">
            <button type="button" onClick={() => setShowStockPicker(true)}
              className="px-md py-sm bg-secondary text-on-secondary rounded-lg font-label-md hover:bg-secondary/90 flex items-center gap-1 shadow-sm cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">photo_library</span>
              Stock Photos
            </button>
            <button type="button" onClick={onPick} disabled={busy} data-testid={`${testid}-pick`}
              className="px-md py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low disabled:opacity-60 flex items-center gap-1 cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">upload</span>
              {busy ? 'Uploading…' : (strVal ? 'Replace image' : 'Upload image')}
            </button>
            {strVal && (
              <button type="button" onClick={onClear} data-testid={`${testid}-clear`}
                className="px-md py-sm border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low cursor-pointer">
                Remove
              </button>
            )}
          </div>
          <input type="text" placeholder="…or paste an image URL"
            value={strVal} onChange={(e) => onChange(e.target.value)}
            data-testid={`${testid}-url`}
            className="w-full min-w-0 px-md py-sm bg-white border border-outline-variant rounded-lg font-body-sm" />
          {err && <span className="font-label-sm text-error" data-testid={`${testid}-err`}>{err}</span>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid={`${testid}-input`} />
    </div>
  );
}

export async function resizeImage(file, maxWidth = 1000, maxHeight = 1000) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxWidth && height <= maxHeight) return resolve(file);
        
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name, { type: mimeType, lastModified: Date.now() }));
        }, mimeType, 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadOrEmbed(file, folder) {
  const processedFile = await resizeImage(file);
  
  try {
    const formData = new FormData();
    formData.append('file', processedFile);
    formData.append('folder', folder);
    
    const res = await api.post('/api/storage/upload', formData);
    if (res?.url) {
      return res.url;
    }
  } catch (err) {
    console.error('[LogoUploader] Upload to R2 via backend failed, using base64 fallback:', err);
  }

  // Fallback: embed as data URL.
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(processedFile);
  });
}
