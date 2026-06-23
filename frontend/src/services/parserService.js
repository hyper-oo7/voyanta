// File parser — xlsx + csv only (per scope decision).
// Returns { columns: string[], rows: Array<Object> }.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export async function parseFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(file);
  throw new Error(`Unsupported file type: .${ext} (supported: .csv, .xlsx)`);
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
