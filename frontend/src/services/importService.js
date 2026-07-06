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
    // Required-field defaults so insert doesn't fail on `not null`
    if (resource === 'hotels'     && !r.name)    r.name    = row[Object.keys(row)[0]] || 'Imported Hotel';
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
  if (field === 'depart_date') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return String(v);
}
