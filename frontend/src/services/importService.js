import { supabase, getAgencyId } from '../lib/supabaseClient.js';

// Persists a parsed file into the imports table, then bulk-inserts mapped
// records into the destination resource table (hotels/flights/activities/templates).
// Each persisted record keeps the full original row in `raw` jsonb.

export async function saveImport({ resource, filename, fileFormat, columns, rows, mapping }) {
  if (!supabase) throw new Error('Supabase not configured');
  const agencyId = getAgencyId();

  // 1) record the import itself
  const { data: imp, error: impErr } = await supabase.from('imports').insert({
    agency_id: agencyId,
    resource,
    filename,
    file_format: fileFormat,
    status: 'mapped',
    source_columns: columns,
    raw_rows: rows,
    mapping,
  }).select().single();
  if (impErr) throw impErr;

  // 2) build records using mapping ({ source_col: target_field })
  const records = rows.map((row) => {
    const r = { agency_id: agencyId, raw: row };
    for (const [src, tgt] of Object.entries(mapping)) {
      if (!tgt) continue;
      const v = row[src];
      if (v === undefined || v === '') continue;
      r[tgt] = coerceValue(resource, tgt, v);
    }
    // Predefined schema normalization & required field defaults
    if (resource === 'hotels') {
      if (!r.name) {
        const fallbackName = Object.values(row).find(val => val && String(val).trim().length > 2 && !String(val).startsWith('http'));
        r.name = fallbackName || 'Imported Hotel';
      }
      if (!r.location) r.location = r.country || 'Imported Location';
      if (!r.meal_type) r.meal_type = r.meal_plan || 'CP (Breakfast)';
      if (!r.room_type) r.room_type = 'Deluxe Room';
      if (!r.price_per_night && r.price) r.price_per_night = Number(r.price);
      if (!r.price_per_night) r.price_per_night = 5000;
      if (!r.currency) r.currency = 'INR';
      if (!r.image_url) r.image_url = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800';
      if (!r.amenities || !Array.isArray(r.amenities) || r.amenities.length === 0) {
        r.amenities = ['WiFi', 'Air Conditioning', 'Room Service'];
      }
    }
    if (resource === 'flights'    && !r.airline) r.airline = row[Object.keys(row)[0]] || 'Imported Airline';
    if (resource === 'activities' && !r.name)    r.name    = row[Object.keys(row)[0]] || 'Imported Activity';
    if (resource === 'templates'  && !r.name)    r.name    = row[Object.keys(row)[0]] || 'Imported Template';
    return r;
  });

  // 3) bulk insert
  const { data: inserted, error: insErr } = await supabase.from(resource).insert(records).select();
  if (insErr) throw insErr;

  // 4) update import row + remember mapping
  await supabase.from('imports').update({ status: 'imported', imported_count: inserted.length }).eq('id', imp.id);
  await supabase.from('field_mappings').upsert({
    agency_id: agencyId, resource, name: 'default', mapping,
  }, { onConflict: 'agency_id,resource,name' });

  return { import_id: imp.id, inserted_count: inserted.length };
}

export async function loadSavedMapping(resource) {
  if (!supabase) return {};
  const agencyId = getAgencyId();
  const { data } = await supabase.from('field_mappings')
    .select('mapping')
    .eq('agency_id', agencyId).eq('resource', resource).eq('name', 'default').maybeSingle();
  return data?.mapping || {};
}

function coerceValue(resource, field, v) {
  const numericFields = new Set(['rating','price_per_night','price','cost','duration_hours','price_from','days']);
  if (numericFields.has(field)) {
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
  }
  if (field === 'amenities') {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }
  if (field === 'depart_date') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return String(v);
}
