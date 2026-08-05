import { ApiError, NetworkError, TimeoutError, ClientError, ServerError } from '../utils/apiErrors.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../lib/supabaseClient.js';

export function normalizeStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (url.startsWith('http://127.0.0.1:8000/api/') || url.startsWith('http://localhost:8000/api/')) {
      const path = url.replace(/http:\/\/(127\.0\.0\.1|localhost):8000/, '');
      return getBackendUrl(path);
    }
  }
  return url;
}

export function getBackendUrl(path = '') {
  if (path && typeof path === 'string' && (path.startsWith('http://127.0.0.1:8000/api') || path.startsWith('http://localhost:8000/api'))) {
    path = path.replace(/http:\/\/(127\.0\.0\.1|localhost):8000/, '');
  }
  let base = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (path.startsWith('/api')) {
      return path;
    }
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      base = '';
    }
    if (!base) {
      base = 'https://voyanta-production-138b.up.railway.app';
    }
  }
  if (!path) return base;
  if (path.startsWith('/api')) {
    if (base) return `${base}${path}`;
    return path;
  }
  if (base && !path.startsWith('http://') && !path.startsWith('https://')) {
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  return path;
}

/* ── Endpoint-specific timeouts ──────────────────────────────────── */

const DEFAULT_TIMEOUT_MS = 15000;   // Simple CRUD
const UPLOAD_TIMEOUT_MS = 60000;    // File uploads (binary data)
const EXTRACTION_TIMEOUT_MS = 120000; // PDF parsing (backend LLM)
const GENERATION_TIMEOUT_MS = 120000; // Itinerary assembly (backend agent)
const RAG_TIMEOUT_MS = 30000;       // Vector search
const POLL_TIMEOUT_MS = 15000;      // Status polling (should be fast)

function resolveTimeout(url, method = 'GET') {
  const lowerUrl = url.toLowerCase();
  const lowerMethod = method.toLowerCase();

  // Generation endpoints
  if (lowerUrl.includes('/assemble-1shot') || lowerUrl.includes('/generate')) {
    return GENERATION_TIMEOUT_MS;
  }

  // Extraction / import
  if (
    lowerUrl.includes('/import/process') ||
    lowerUrl.includes('/import/status') ||
    lowerUrl.includes('/import/extract-text') ||
    lowerUrl.includes('/extract')
  ) {
    return lowerUrl.includes('/status') ? POLL_TIMEOUT_MS : EXTRACTION_TIMEOUT_MS;
  }

  // File uploads (multipart)
  if (lowerMethod === 'post' && (lowerUrl.includes('/upload') || lowerUrl.includes('/import'))) {
    return UPLOAD_TIMEOUT_MS;
  }

  // RAG / vector search
  if (lowerUrl.includes('/rag/') || lowerUrl.includes('/search')) {
    return RAG_TIMEOUT_MS;
  }

  return DEFAULT_TIMEOUT_MS;
}

/* ── Retry configuration ─────────────────────────────────────────── */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function shouldRetry(error, attempt) {
  if (attempt >= MAX_RETRIES) return false;
  if (!error) return false;

  // Retryable by type
  if (error instanceof NetworkError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof ServerError && error.retryable) return true;

  // Specific status codes
  if (error.status === 429) return true; // Rate limit
  if (error.status >= 502 && error.status <= 504) return true;

  return false;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Core fetch wrapper ──────────────────────────────────────────── */

async function _fetchWithTimeout(url, options = {}) {
  const method = options.method || 'GET';
  const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : getBackendUrl(url);
  const timeoutMs = options.timeout || resolveTimeout(url, method);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (supabase && (!headers.Authorization && !headers.authorization)) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {}
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(id);

    // Parse body (handle empty responses gracefully)
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (response.status !== 204) {
      const text = await response.text();
      data = text ? { message: text } : null;
    }

    // Classify errors
    if (!response.ok) {
      const message = data?.detail || data?.message || data?.error || response.statusText;

      if (response.status >= 400 && response.status < 500) {
        throw new ClientError(response.status, message, url, null);
      }
      throw new ServerError(response.status, message, url, null);
    }

    return data;
  } catch (err) {
    clearTimeout(id);

    // Distinguish AbortError (our timeout) from network failures
    if (err.name === 'AbortError') {
      throw new TimeoutError(url, timeoutMs, err);
    }

    if (err instanceof TypeError || err.message?.includes('fetch')) {
      throw new NetworkError(url, err);
    }

    // Re-throw already-classified errors
    if (err instanceof ApiError) throw err;

    // Unknown
    throw new ApiError(err.message || 'Request failed', {
      url,
      original: err,
      retryable: false,
    });
  }
}

/* ── Retry wrapper ───────────────────────────────────────────────── */

async function requestWithRetry(url, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _fetchWithTimeout(url, options);
    } catch (err) {
      lastError = err;

      if (!shouldRetry(err, attempt)) {
        throw err;
      }

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
      logger.warn(
        `[API] Retry ${attempt + 1}/${MAX_RETRIES} for ${options.method || 'GET'} ${url} after ${delay}ms — ${err.code || err.message}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/* ── Public API client ───────────────────────────────────────────── */

export const api = {
  get: (url, options = {}) => requestWithRetry(url, { ...options, method: 'GET' }),

  post: (url, body, options = {}) => {
    const isFormData = body instanceof FormData;
    const headers = isFormData
      ? { ...(options.headers || {}) } // Let browser set Content-Type for FormData
      : { 'Content-Type': 'application/json', ...(options.headers || {}) };

    const payload = isFormData ? body : JSON.stringify(body);

    return requestWithRetry(url, {
      ...options,
      method: 'POST',
      headers,
      body: payload,
    });
  },

  put: (url, body, options = {}) =>
    requestWithRetry(url, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body),
    }),

  patch: (url, body, options = {}) =>
    requestWithRetry(url, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body),
    }),

  delete: (url, options = {}) => requestWithRetry(url, { ...options, method: 'DELETE' }),
};

/* ── Convenience helpers ─────────────────────────────────────────── */

/**
 * Upload a file with progress tracking (if a callback is provided).
 * Falls back to standard api.post if progress isn't supported.
 */
api.upload = async (url, formData, { onProgress, ...options } = {}) => {
  if (!onProgress) {
    return api.post(url, formData, { ...options, timeout: UPLOAD_TIMEOUT_MS });
  }

  const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : getBackendUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
      }
    });

    xhr.addEventListener('load', () => {
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        const message = data?.detail || data?.message || xhr.statusText;
        if (xhr.status >= 400 && xhr.status < 500) {
          reject(new ClientError(xhr.status, message, url, null));
        } else {
          reject(new ServerError(xhr.status, message, url, null));
        }
      }
    });

    xhr.addEventListener('error', () => {
      clearTimeout(timeoutId);
      reject(new NetworkError(url, new Error('XHR network error')));
    });

    xhr.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new TimeoutError(url, UPLOAD_TIMEOUT_MS, new Error('XHR aborted')));
    });

    xhr.open('POST', fullUrl);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(formData);
  });
};

export async function uploadDocument(file, agencyId = 'global') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('agency_id', agencyId);
  const data = await api.post('/api/documents/upload', formData);
  return { data };
}

export async function listDocuments(agencyId = 'global') {
  const data = await api.get(`/api/documents/?agency_id=${encodeURIComponent(agencyId)}`);
  return { data };
}

export async function deleteDocument(docId, agencyId = 'global') {
  const data = await api.delete(`/api/documents/${docId}?agency_id=${encodeURIComponent(agencyId)}`);
  return { data };
}

export async function generateProposalWithTemplate(payload) {
  const data = await api.post('/api/proposals/generate-with-template', payload);
  return { data };
}

export async function saveProposal(payload) {
  const data = await api.post('/api/proposals/save', payload);
  return { data };
}

export async function executeRAGQuery(payload) {
  const data = await api.post('/api/rag/query', payload);
  return { data };
}

export default api;
