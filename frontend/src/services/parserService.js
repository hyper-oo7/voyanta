// File parser — CSV/XLSX remain client-side. PDF is now 100% backend-driven.
// Backend contract required:
//   POST /api/import/process      → { job_id: string }
//   GET  /api/import/status/:id   → { status, progress?, result?, error?, raw_text? }
//   POST /api/import/extract-text → { text: string }  (raw fallback)

import * as XLSX from 'xlsx';
import { api } from './api.js';
import { logger } from '../utils/logger.js';
import Papa from 'papaparse';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes max

/* ------------------------------------------------------------------ */
/*  PDF — Async backend extraction with polling                       */
/* ------------------------------------------------------------------ */

/**
 * Upload a PDF and receive a jobId for async processing.
 */
export async function uploadPdfForExtraction(file, agencyId = 'demo-agency') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('agency_id', agencyId);
  formData.append('currency', 'INR');

  const result = await api.post('/api/import/process', formData, {
    headers: {}, // Let browser set multipart boundary
  });

  if (!result?.job_id) {
    throw new Error('Backend did not return a job_id. Ensure /api/import/process returns { job_id }.');
  }
  return result.job_id;
}

/**
 * Poll backend until extraction completes or fails.
 * @param {string} jobId
 * @param {(progress: {stage:string,current:number,total:number})=>void} [onProgress]
 */
export async function pollExtractionStatus(jobId, onProgress) {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    const status = await api.get(`/api/import/status/${jobId}`);

    if (onProgress && status?.progress) {
      onProgress(status.progress);
    }

    if (status?.status === 'completed') {
      return status.result;
    }

    if (status?.status === 'failed') {
      const err = new Error(status.error || 'Extraction failed on the backend.');
      err.rawText = status.raw_text || null;
      err.jobId = jobId;
      logger.error(`Extraction job ${jobId} failed:`, err.message);
      throw err;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Extraction timed out. The backend is taking too long to process this PDF.');
}

/**
 * Last-resort endpoint: ask backend to return raw text only (no LLM parsing).
 * Used when structured extraction fails so the user can copy-paste manually.
 */
export async function extractRawPdfText(file, agencyId = 'demo-agency') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('agency_id', agencyId);

  try {
    const result = await api.post('/api/import/extract-text', formData, {
      headers: {},
    });
    return result?.text || '';
  } catch (err) {
    logger.error('Raw text extraction failed:', err);
    return '';
  }
}

/**
 * Parse a PDF file.
 * 1. Uploads to backend
 * 2. Polls for completion
 * 3. Returns normalized structured data
 * 4. On failure: attempts raw-text extraction for manual fallback
 */
export async function parsePdfFile(file, options = {}) {
  const { agencyId = 'demo-agency', onProgress } = options;

  let jobId;
  try {
    jobId = await uploadPdfForExtraction(file, agencyId);
  } catch (uploadErr) {
    logger.error('PDF upload failed:', uploadErr);
    throw new Error('Failed to upload PDF for processing. Please check your network connection.');
  }

  try {
    const result = await pollExtractionStatus(jobId, onProgress);

    return {
      name: result?.destination || file.name.replace(/\.pdf$/i, ''),
      destination: result?.destination || '',
      days_count: result?.days?.length || 0,
      days: result?.days || [],
      hotels: result?.hotels || [],
      activities: result?.activities || [],
      flights: result?.flights || [],
      fields: result?.fields || {},
    };
  } catch (pollErr) {
    // Structured extraction failed — try to fetch raw text for manual copy-paste
    if (!pollErr.rawText) {
      pollErr.rawText = await extractRawPdfText(file, agencyId);
    }
    throw pollErr;
  }
}

/* ------------------------------------------------------------------ */
/*  CSV / XLSX — Client-side (fast, reliable)                         */
/* ------------------------------------------------------------------ */

export async function parseFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(file);
  if (ext === 'pdf') return parsePdfFile(file);
  throw new Error(`Unsupported file type: .${ext} (supported: .csv, .xlsx, .pdf)`);
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const columns = (meta.fields || []).map(String);
        const rows = data.map((r) => coerceRow(r, columns));
        resolve({ columns, rows });
      },
      error: reject,
    });
  });
}

async function parseXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { columns: [], rows: [] };
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const columns = json.length ? Object.keys(json[0]).map(String) : [];
  const rows = json.map((r) => coerceRow(r, columns));
  return { columns, rows };
}

function coerceRow(row, columns) {
  const out = {};
  for (const c of columns) {
    const v = row[c];
    out[c] = v === undefined || v === null ? '' : String(v).trim();
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Heuristic column mapping (CSV/XLSX)                               */
/* ------------------------------------------------------------------ */

const SYNONYMS = {
  hotels: {
    name: ['name','hotel','hotel_name','property','property_name','resort','resort_name','hotel_title','title','accommodation','hotel_name_or_property','vendor','vendor_name'],
    location: ['city','location','town','address','place','district','area','locality','destination','city_name','hotel_location'],
    country: ['country','nation','state','country_name','region'],
    category: ['category','type','class','style','star','stars','star_rating','hotel_category','hotel_type','property_type','grade'],
    rating: ['rating','stars','star','score','user_rating','review_score','tripadvisor_rating'],
    price_per_night: ['price','rate','cost','price_per_night','nightly','tariff','nightly_rate','room_rate','rack_rate','b2b_rate','amount','nett_rate','gross_rate','cp_rate','map_rate','ep_rate','price_night'],
    meal_type: ['meal','meal_type','meal_plan','meals','board','plan','board_basis','food','inclusions','inclusions_meals','dining'],
    room_type: ['room','room_type','room_category','room_kind','accommodation_type','bed_type','room_name','category_room'],
    amenities: ['amenities','amenity','facilities','features','inclusions','services','specs','hotel_amenities','hotel_facilities'],
    currency: ['currency','ccy','cur','monetary_unit','currency_code'],
    image_url: ['image','photo','image_url','picture','img','photo_url','cover_image','thumbnail','url','link','image_path','image_link']
  },
  flights: {
    airline: ['airline','carrier','flight_carrier','airline_name','operator'],
    class: ['class','cabin','travel_class','booking_class','cabin_class'],
    origin: ['origin','from','depart','departure_city','departure','origin_airport','from_city'],
    destination: ['destination','to','arrival_city','arrival','dest','arrival_airport','to_city'],
    depart_date: ['date','depart_date','departure_date','date_of_departure','flight_date'],
    flight_no: ['flight','flight_no','flight_number','flight_code','number'],
    duration: ['duration','length','flight_duration','travel_time'],
    cost: ['price','cost','fare','total','airfare','total_cost','ticket_price'],
    currency: ['currency','ccy','cur']
  },
  activities: {
    name: ['name','activity','title','activity_name','sightseeing','tour','tour_name','event','experience','excursion'],
    type: ['type','category','activity_type','genre'],
    location: ['place','city','location','venue','destination','area','district'],
    duration_hours: ['duration','hours','length','duration_hours','time','timing'],
    price: ['price_per_person','price_person','price','cost_per_person','rate_per_person','pax_price','ticket_price','rate','cost','fee','amount'],
    currency: ['currency','ccy'],
    description: ['description','desc','details','summary','overview','about','inclusions'],
    image_url: ['image','photo','picture','image_url','photo_url','thumbnail','cover_image']
  },
  attractions: {
    name: ['name','attraction','attraction_name','monument','site','spot','place_name','point_of_interest','landmark','destination_spot'],
    location: ['location','place','city','destination','district','area','address'],
    duration: ['duration','hours','time','visit_duration','recommended_time','timing','hours_needed','length'],
    price: ['price','entry_fee','fee','ticket_price','cost','amount'],
    currency: ['currency','ccy'],
    description: ['description','desc','details','summary','overview','about','highlights'],
    image_url: ['image','photo','picture','image_url','photo_url','thumbnail','cover_image']
  },
  templates: {
    name: ['name','title','template','package','package_name','itinerary_title'],
    category: ['category','type','style','theme'],
    days: ['days','nights','duration','days_count','total_days'],
    destination: ['destination','region','country','city'],
    price_from: ['price','from','starting','price_from','base_price'],
    currency: ['currency','ccy'],
    image_url: ['image','photo','cover','image_url','banner']
  }
};

export function suggestMapping(resource, columns, rows = []) {
  const synonyms = SYNONYMS[resource] || {};
  const used = new Set();
  const out = {};

  // Tier 1: Exact & normalized synonym header matching
  for (const [target, alts] of Object.entries(synonyms)) {
    const match = columns.find((c) => {
      if (used.has(c)) return false;
      const lower = c.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      return alts.some((a) => lower === a || lower === a + 's' || lower.split('_').includes(a));
    });
    if (match) {
      out[match] = target;
      used.add(match);
    }
  }

  // Tier 2: Sample data pattern recognition (for unmapped headers)
  if (rows && rows.length > 0) {
    const unmappedCols = columns.filter((c) => !used.has(c));
    const sampleRows = rows.slice(0, 5);

    for (const c of unmappedCols) {
      const sampleVals = sampleRows.map((r) => String(r[c] || '').trim()).filter(Boolean);
      if (sampleVals.length === 0) continue;

      // Image URL pattern
      if (!Object.values(out).includes('image_url') && synonyms.image_url) {
        const isUrl = sampleVals.some((v) => /^https?:\/\//i.test(v) || /\.(jpg|jpeg|png|webp|gif)/i.test(v));
        if (isUrl) {
          out[c] = 'image_url';
          used.add(c);
          continue;
        }
      }

      // Meal Type pattern
      if (resource === 'hotels' && !Object.values(out).includes('meal_type')) {
        const isMeal = sampleVals.some((v) => /^(cp|ep|map|ap|breakfast|half board|full board|all inclusive|room only)/i.test(v));
        if (isMeal) {
          out[c] = 'meal_type';
          used.add(c);
          continue;
        }
      }

      // Room Type pattern
      if (resource === 'hotels' && !Object.values(out).includes('room_type')) {
        const isRoom = sampleVals.some((v) => /(deluxe|suite|executive|standard|superior|villa|bungalow|ocean view|city view|king|queen|twin|double)/i.test(v));
        if (isRoom) {
          out[c] = 'room_type';
          used.add(c);
          continue;
        }
      }

      // Currency pattern
      if (!Object.values(out).includes('currency') && synonyms.currency) {
        const isCcy = sampleVals.every((v) => /^(inr|usd|eur|gbp|aed|thb|jpy|aud|cad|₹|\$|€|£)$/i.test(v));
        if (isCcy) {
          out[c] = 'currency';
          used.add(c);
          continue;
        }
      }

      // Rating pattern
      if (resource === 'hotels' && !Object.values(out).includes('rating')) {
        const isRating = sampleVals.every((v) => {
          const n = parseFloat(v);
          return !isNaN(n) && n >= 1.0 && n <= 5.0 && v.length <= 4;
        });
        if (isRating) {
          out[c] = 'rating';
          used.add(c);
          continue;
        }
      }

      // Price pattern
      const targetPriceField = resource === 'hotels' ? 'price_per_night' : resource === 'flights' ? 'cost' : 'price';
      if (!Object.values(out).includes(targetPriceField)) {
        const isPrice = sampleVals.some((v) => /[\d,]+\.?\d*/.test(v) && !isNaN(parseFloat(v.replace(/[^0-9.]/g, ''))) && parseFloat(v.replace(/[^0-9.]/g, '')) > 50);
        if (isPrice && !sampleVals.some((v) => v.includes('http'))) {
          out[c] = targetPriceField;
          used.add(c);
          continue;
        }
      }
    }
  }

  return out;
}

export const TARGET_FIELDS = {
  hotels:     ['name','location','country','category','rating','price_per_night','meal_type','room_type','amenities','currency','image_url'],
  flights:    ['airline','class','origin','destination','depart_date','flight_no','duration','cost','currency'],
  activities: ['name','type','location','duration_hours','price','currency','description','image_url'],
  attractions:['name','location','duration','price','currency','description','image_url'],
  templates:  ['name','category','days','destination','price_from','currency','image_url'],
};
