import { logger } from '../utils/logger.js';
import { supabase } from '../lib/supabaseClient.js';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Perform an API request with standard handling.
 * @param {string} endpoint - The relative URL (e.g. '/api/parse-itinerary')
 * @param {RequestInit} options - Fetch options
 * @param {number} retries - Number of retries for transient GET failures
 */
async function fetchWithRetry(endpoint, options = {}, retries = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);
  
  const config = {
    ...options,
    signal: options.signal || controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Attach auth token if available
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(endpoint, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errData;
      try {
        errData = await response.json();
      } catch (e) {
        errData = await response.text();
      }
      throw new ApiError(
        typeof errData === 'string' ? errData : errData.detail || errData.message || response.statusText,
        response.status,
        errData
      );
    }

    // Handle Blob response if explicitly requested
    if (options.responseType === 'blob') {
      return await response.blob();
    }

    // Default JSON parsing
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      logger.warn(`Request aborted or timed out: ${endpoint}`);
      throw new Error('Request timed out. Please try again.');
    }

    const isTransient = error.name !== 'ApiError' || error.status >= 500 || error.status === 429;
    if (isTransient && retries > 0 && (!config.method || config.method.toUpperCase() === 'GET')) {
      logger.warn(`Retrying request ${endpoint}. Retries left: ${retries - 1}`);
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(endpoint, options, retries - 1);
    }

    logger.error(`API Error on ${config.method || 'GET'} ${endpoint}:`, error.message);
    throw error;
  }
}

export const api = {
  get: (url, options) => fetchWithRetry(url, { ...options, method: 'GET' }),
  post: (url, body, options) => fetchWithRetry(url, { ...options, method: 'POST', body }),
  put: (url, body, options) => fetchWithRetry(url, { ...options, method: 'PUT', body }),
  patch: (url, body, options) => fetchWithRetry(url, { ...options, method: 'PATCH', body }),
  delete: (url, options) => fetchWithRetry(url, { ...options, method: 'DELETE' }),
};
