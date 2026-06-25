// File parser — xlsx + csv only (per scope decision).
// Returns { columns: string[], rows: Array<Object> }.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

async function loadPdfJS() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function extractTextFromPdf(file) {
  const pdfjs = await loadPdfJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
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
  
  for (const d of days) {
    for (const h of d.hotels) {
      if (h && !hotels.some(x => x.name.toLowerCase() === h.toLowerCase())) {
        hotels.push({ name: h, location: destination || "Imported Location", price_per_night: 5000 });
      }
    }
    for (const act of d.activities) {
      if (act && !activities.some(x => x.name.toLowerCase() === act.toLowerCase())) {
        activities.push({ name: act, price: 1000, description: "Imported activity" });
      }
    }
  }
  
  return {
    name,
    destination,
    days_count: days.length,
    days,
    hotels,
    activities
  };
}

export async function parsePdfFile(file) {
  // TODO: Integrate with AI itinerary parsing service (e.g. OpenAI / Claude) to handle unstructured PDF parsing.
  // Currently falling back to deterministic keyword/regex-based extraction.
  const text = await extractTextFromPdf(file);
  return parseItineraryTextLocally(text);
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
  hotels:     { name: ['name','hotel','property','title'], location: ['city','location','town'], country: ['country','nation'], category: ['category','type','class','style'], rating: ['rating','stars','star'], price_per_night: ['price','rate','cost','price_per_night','nightly'], currency: ['currency','ccy','cur'], image_url: ['image','photo','image_url','picture'] },
  flights:    { airline: ['airline','carrier'], class: ['class','cabin'], origin: ['origin','from','depart','departure_city'], destination: ['destination','to','arrival_city','dest'], depart_date: ['date','depart_date','departure_date','date_of_departure'], flight_no: ['flight','flight_no','flight_number'], duration: ['duration','length'], cost: ['price','cost','fare','total'], currency: ['currency','ccy','cur'] },
  activities: { name: ['name','activity','title'], type: ['type','category'], location: ['city','location','place'], duration_hours: ['duration','hours','length'], price: ['price','cost','rate'], currency: ['currency','ccy'], description: ['description','desc','details'], image_url: ['image','photo','picture'] },
  templates:  { name: ['name','title','template'], category: ['category','type','style'], days: ['days','nights','duration'], destination: ['destination','region','country','city'], price_from: ['price','from','starting','price_from'], currency: ['currency','ccy'], image_url: ['image','photo','cover'] },
};

export function suggestMapping(resource, columns) {
  const synonyms = SYNONYMS[resource] || {};
  const used = new Set();
  const out = {};
  for (const [target, alts] of Object.entries(synonyms)) {
    const match = columns.find((c) => {
      if (used.has(c)) return false;
      const lower = c.toLowerCase().replace(/\s+/g, '_');
      return alts.some((a) => lower === a || lower.includes(a));
    });
    if (match) { out[match] = target; used.add(match); }
  }
  return out;
}

export const TARGET_FIELDS = {
  hotels:     ['name','location','country','category','rating','price_per_night','currency','image_url'],
  flights:    ['airline','class','origin','destination','depart_date','flight_no','duration','cost','currency'],
  activities: ['name','type','location','duration_hours','price','currency','description','image_url'],
  templates:  ['name','category','days','destination','price_from','currency','image_url'],
};
