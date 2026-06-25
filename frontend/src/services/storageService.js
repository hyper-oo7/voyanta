// Generic file/image upload helper that targets the Supabase Storage bucket
// `agency-assets`. Every caller picks a folder (logos / covers / hotels /
// activities / destinations / client-files / proposal-pdfs / templates).
//
// If Supabase isn't configured or the bucket isn't reachable, images
// gracefully degrade to base64 data URLs so the UI keeps working. For
// non-image files (PDFs, docs) the helper throws — the caller MUST
// handle a real upload error in that case.

import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';

export const BUCKET = 'agency-assets';

export const FOLDERS = Object.freeze({
  LOGOS: 'logos',
  COVERS: 'covers',
  HOTELS: 'hotels',
  ACTIVITIES: 'activities',
  DESTINATIONS: 'destinations',
  TEMPLATES: 'templates',
  CLIENT_FILES: 'client-files',
  PROPOSAL_PDFS: 'proposal-pdfs',
});

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB
const DEFAULT_MAX_FILE_BYTES  = 25 * 1024 * 1024;      // 25 MB

// Upload an image and return its public URL. Falls back to a data URL when
// Supabase storage is unavailable (so previews still work in demo mode).
export async function uploadImage(file, folder, { maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!file) throw new Error('No file');
  if (!file.type?.startsWith('image/')) throw new Error('Only image files');
  if (file.size > maxBytes) throw new Error(`Max ${Math.round(maxBytes / 1024 / 1024)} MB`);

  if (supabase) {
    try {
      const path = buildPath(folder, file.name);
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (!error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      }
    } catch { /* fallthrough → embed */ }
  }
  return await readAsDataURL(file);
}

// Upload an arbitrary file (PDF, doc, image) and return its public URL.
// Unlike uploadImage(), this does NOT fall back to a data URL: real files
// must round-trip through storage.
export async function uploadFile(file, folder, { maxBytes = DEFAULT_MAX_FILE_BYTES } = {}) {
  if (!file) throw new Error('No file');
  if (file.size > maxBytes) throw new Error(`Max ${Math.round(maxBytes / 1024 / 1024)} MB`);
  if (!supabase) throw new Error('Supabase storage not configured');

  const path = buildPath(folder, file.name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream',
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Failed to derive public URL');
  return { url: data.publicUrl, path, name: file.name, size: file.size, type: file.type };
}

// Convenience for generated artefacts (PDF blobs we want to archive).
export async function uploadBlob(blob, filename, folder) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  return await uploadFile(file, folder);
}

function buildPath(folder, filename) {
  const ext = (String(filename).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${folder}/${DEFAULT_AGENCY_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}
