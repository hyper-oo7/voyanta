// File parser — xlsx + csv only (per scope decision).
// Returns { columns: string[], rows: Array<Object> }.
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { logger } from '../utils/logger.js';
import Papa from 'papaparse';

// pdfjs-dist is bundled via npm — no CDN, no runtime script injection.
// The worker is served as a hashed static asset via Vite's ?url import.
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(' ') + '\n';
  }
  return text;
}

function parseItineraryTextLocally(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let name = "Imported Itinerary";
  let destination = "";
  let days = [];
  let currentDay = null;
  
  if (lines.length > 0) {
    name = lines[0].slice(0, 80);
  }
  
  const dayRegex = /^(?:Day|DAY)\s*(\d+|[a-zA-Z]+)(?::|-|\s+)?(.*)$/i;
  
  for (const line of lines) {
    const dayMatch = line.match(dayRegex);
    if (dayMatch) {
      if (currentDay) {
        days.push(currentDay);
      }
      const dayNum = parseInt(dayMatch[1], 10) || (days.length + 1);
      const dayTitle = dayMatch[2].trim() || `Day ${dayNum}`;
      currentDay = {
        day: dayNum,
        title: dayTitle,
        description: "",
        hotels: [],
        activities: [],
        transfers: [],
        meals: [],
        notes: ""
      };
      continue;
    }
    
    if (!currentDay) {
      if (line.toLowerCase().includes('destination:') || line.toLowerCase().includes('location:')) {
        destination = line.split(':').pop().trim();
      }
      continue;
    }
    
    const lower = line.toLowerCase();
    
    if (lower.includes('hotel:') || lower.includes('accommodation:') || lower.includes('stay:')) {
      currentDay.hotels.push(line.split(':').pop().trim());
    } else if (lower.includes('activity:') || lower.includes('sightseeing:') || lower.includes('tour:')) {
      currentDay.activities.push(line.split(':').pop().trim());
    } else if (lower.includes('transfer:') || lower.includes('flight:') || lower.includes('drive:')) {
      currentDay.transfers.push(line.split(':').pop().trim());
    } else if (lower.includes('meal:') || lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner')) {
      if (lower.includes('breakfast')) currentDay.meals.push('Breakfast');
      if (lower.includes('lunch')) currentDay.meals.push('Lunch');
      if (lower.includes('dinner')) currentDay.meals.push('Dinner');
      if (currentDay.meals.length === 0) currentDay.meals.push(line.split(':').pop().trim());
    } else if (lower.includes('note:') || lower.includes('notes:') || lower.includes('important:')) {
      currentDay.notes += (currentDay.notes ? ' ' : '') + line.split(':').pop().trim();
    } else {
      currentDay.description += (currentDay.description ? '\n' : '') + line;
    }
  }
  
  if (currentDay) {
    days.push(currentDay);
  }
  
  for (const d of days) {
    d.meals = Array.from(new Set(d.meals));
  }
  
  const hotels = [];
  const activities = [];
  const flights = [];
  
  for (const d of days) {
    for (const h of d.hotels) {
      if (h && !hotels.some(x => x.name.toLowerCase() === h.toLowerCase())) {
        hotels.push({ name: h, location: destination || "Imported Location", price_per_night: null });
      }
    }
    for (const act of d.activities) {
      if (act && !activities.some(x => x.name.toLowerCase() === act.toLowerCase())) {
        activities.push({ name: act, price: null, description: "Imported activity" });
      }
    }
    for (const t of d.transfers) {
      if (t && (t.toLowerCase().includes('flight') || t.toLowerCase().includes('air'))) {
        const cleanVal = t.replace(/(?:flight|transfer|drive|air)\s*/i, '').trim();
        if (cleanVal && !flights.some(x => x.flight_no.toLowerCase() === cleanVal.toLowerCase())) {
          const parts = cleanVal.split(/\s+/);
          flights.push({
            airline: parts[0] || 'Imported Airline',
            flight_no: parts[1] || parts[0] || 'TBD',
            cost: null,
            currency: 'INR'
          });
        }
      }
    }
  }
  
  const fields = {
    destination: {
      value: destination,
      confidence: destination ? 0.5 : 0.0,
      source: destination ? 'deterministic' : 'missing',
      needs_review: !destination
    },
    total_price: {
      value: null,
      confidence: 0.0,
      source: 'missing',
      needs_review: true
    },
    currency: {
      value: 'INR',
      confidence: 0.5,
      source: 'deterministic',
      needs_review: true
    },
    duration_days: {
      value: days.length,
      confidence: days.length > 0 ? 0.8 : 0.0,
      source: days.length > 0 ? 'deterministic' : 'missing',
      needs_review: days.length === 0
    },
    days: {
      value: days,
      confidence: days.length > 0 ? 0.7 : 0.0,
      source: days.length > 0 ? 'deterministic' : 'missing',
      needs_review: days.length === 0
    },
    hotels: {
      value: hotels,
      confidence: hotels.length > 0 ? 0.6 : 0.0,
      source: hotels.length > 0 ? 'deterministic' : 'missing',
      needs_review: hotels.length > 0
    },
    activities: {
      value: activities,
      confidence: activities.length > 0 ? 0.6 : 0.0,
      source: activities.length > 0 ? 'deterministic' : 'missing',
      needs_review: activities.length > 0
    },
    flights: {
      value: flights,
      confidence: flights.length > 0 ? 0.6 : 0.0,
      source: flights.length > 0 ? 'deterministic' : 'missing',
      needs_review: flights.length > 0
    }
  };
  
  return {
    name,
    destination,
    days_count: days.length,
    days,
    hotels,
    activities,
    flights,
    fields
  };
}

export async function parsePdfFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('destination', '');
  formData.append('budget', '0');
  formData.append('duration', '0');
  formData.append('currency', 'INR');
  formData.append('reparse', 'true');

  try {
    const result = await api.post('/api/import/process', formData);
    if (result && result.status === 'success' && result.data) {
      const pkg = result.data;
      return {
        name: pkg.destination || file.name.replace('.pdf', ''),
        destination: pkg.destination || '',
        days_count: pkg.days?.length || 0,
        days: pkg.days || [],
        hotels: pkg.hotels || [],
        activities: pkg.activities || [],
        flights: pkg.flights || [],
        fields: pkg.fields || {}
      };
    }
    throw new Error('Invalid response format from import processor');
  } catch (err) {
    logger.warn('Failed to use unified import/process parser, falling back to local extraction.', err);
    const text = await extractTextFromPdf(file);
    return parseItineraryTextLocally(text);
  }
}

export async function parseFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(file);
  if (ext === 'pdf') {
    return parsePdfFile(file);
  }
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

// Heuristic: suggest a default mapping from supplier columns to internal fields.
// Used to pre-fill the mapping UI; user can override.
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

  // Tier 1: Exact & Normalized Synonym Header Matching
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

  // Tier 2: Sample Data Pattern Recognition (for unmapped headers)
  if (rows && rows.length > 0) {
    const unmappedCols = columns.filter(c => !used.has(c));
    const sampleRows = rows.slice(0, 5);

    for (const c of unmappedCols) {
      const sampleVals = sampleRows.map(r => String(r[c] || '').trim()).filter(Boolean);
      if (sampleVals.length === 0) continue;

      // Image URL pattern
      if (!Object.values(out).includes('image_url') && synonyms.image_url) {
        const isUrl = sampleVals.some(v => /^https?:\/\//i.test(v) || /\.(jpg|jpeg|png|webp|gif)/i.test(v));
        if (isUrl) {
          out[c] = 'image_url';
          used.add(c);
          continue;
        }
      }

      // Meal Type pattern
      if (resource === 'hotels' && !Object.values(out).includes('meal_type')) {
        const isMeal = sampleVals.some(v => /^(cp|ep|map|ap|breakfast|half board|full board|all inclusive|room only)/i.test(v));
        if (isMeal) {
          out[c] = 'meal_type';
          used.add(c);
          continue;
        }
      }

      // Room Type pattern
      if (resource === 'hotels' && !Object.values(out).includes('room_type')) {
        const isRoom = sampleVals.some(v => /(deluxe|suite|executive|standard|superior|villa|bungalow|ocean view|city view|king|queen|twin|double)/i.test(v));
        if (isRoom) {
          out[c] = 'room_type';
          used.add(c);
          continue;
        }
      }

      // Currency pattern
      if (!Object.values(out).includes('currency') && synonyms.currency) {
        const isCcy = sampleVals.every(v => /^(inr|usd|eur|gbp|aed|thb|jpy|aud|cad|₹|\$|€|£)$/i.test(v));
        if (isCcy) {
          out[c] = 'currency';
          used.add(c);
          continue;
        }
      }

      // Rating pattern
      if (resource === 'hotels' && !Object.values(out).includes('rating')) {
        const isRating = sampleVals.every(v => {
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
        const isPrice = sampleVals.some(v => /[\d,]+\.?\d*/.test(v) && !isNaN(parseFloat(v.replace(/[^0-9.]/g, ''))) && parseFloat(v.replace(/[^0-9.]/g, '')) > 50);
        if (isPrice && !sampleVals.some(v => v.includes('http'))) {
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
