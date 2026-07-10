// Generic file/image upload helper that targets the Supabase Storage bucket
// `agency-assets`. Every caller picks a folder (logos / covers / hotels /
// activities / destinations / client-files / proposal-pdfs / templates).
//
// If Supabase isn't configured or the bucket isn't reachable, images
// gracefully degrade to base64 data URLs so the UI keeps working. For
// non-image files (PDFs, docs) the helper throws — the caller MUST
// handle a real upload error in that case.

import { supabase, getAgencyId } from '../lib/supabaseClient.js';
import { api } from './api.js';

export const BUCKET = 'agency-assets';
export const PRIVATE_BUCKETS = Object.freeze({
  PROPOSAL_ASSETS: 'proposal-assets',
  GENERATED_DOCS: 'generated-documents',
});

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

function getTargetBucket(folder) {
  if (folder === FOLDERS.PROPOSAL_PDFS || folder === 'proposal-pdfs' || folder === 'generated-documents') {
    return PRIVATE_BUCKETS.GENERATED_DOCS;
  }
  if (folder === FOLDERS.CLIENT_FILES || folder === 'client-files' || folder === 'proposal-assets') {
    return PRIVATE_BUCKETS.PROPOSAL_ASSETS;
  }
  return BUCKET;
}

export async function getSignedUrl(path, bucket = PRIVATE_BUCKETS.GENERATED_DOCS, expiresIn = 3600) {
  const res = await api.get(`/api/storage/sign?path=${encodeURIComponent(path)}&expires_in=${expiresIn}`);
  if (res?.url) return res.url;
  throw new Error('Failed to generate signed URL');
}

// Upload an image and return its public URL. Falls back to a data URL when
// Supabase storage is unavailable (so previews still work in demo mode).
export async function uploadImage(file, folder, { maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!file) throw new Error('No file');
  if (!file.type?.startsWith('image/')) throw new Error('Only image files');
  if (file.size > maxBytes) throw new Error(`Max ${Math.round(maxBytes / 1024 / 1024)} MB`);

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const res = await api.post('/api/storage/upload', formData);
    if (res?.url) return res.url;
  } catch { /* fallthrough → embed */ }
  return await readAsDataURL(file);
}

// Upload an arbitrary file (PDF, doc, image) and return its public URL or signed URL.
// Unlike uploadImage(), this does NOT fall back to a data URL: real files
// must round-trip through storage.
export async function uploadFile(file, folder, { maxBytes = DEFAULT_MAX_FILE_BYTES, expiresIn = 3600 } = {}) {
  if (!file) throw new Error('No file');
  if (file.size > maxBytes) throw new Error(`Max ${Math.round(maxBytes / 1024 / 1024)} MB`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await api.post('/api/storage/upload', formData);
  if (!res?.url) throw new Error('Failed to upload file');
  
  return { url: res.url, path: res.path, bucket: res.bucket, name: file.name, size: file.size, type: file.type };
}

// Convenience for generated artefacts (PDF blobs we want to archive).
export async function uploadBlob(blob, filename, folder, options = {}) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  return await uploadFile(file, folder, options);
}

function buildPath(folder, filename) {
  const ext = (String(filename).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `${folder}/${getAgencyId()}/${Date.now()}-${uuid}.${ext}`;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

