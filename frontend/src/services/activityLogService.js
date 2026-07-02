// Activity log service — writes to Supabase activity_logs table.
// Falls back gracefully if Supabase is unavailable.
import { supabase, getAgencyId } from '../lib/supabaseClient.js';

const PAGE_SIZE = 50;

export async function getActivityLogs(limit = PAGE_SIZE) {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data.map(normalizeLog);
    } catch {}
  }
  return [];
}

export async function logActivity(type, description, clientName = 'Agency Team', entityType = null, entityId = null) {
  const agencyId = getAgencyId();
  try {
    let userId = null;
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch {}

      await supabase.from('activity_logs').insert({
        agency_id: agencyId,
        user_id: userId,
        action: type,
        details: { description, clientName },
        entity_type: entityType,
        entity_id: entityId,
      });
    }
    window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
    return { id: crypto.randomUUID(), action: type, details: { description, clientName }, created_at: new Date().toISOString() };
  } catch (err) {
    console.error('Failed to log activity:', err);
    return null;
  }
}

export async function clearActivityLogs() {
  const agencyId = getAgencyId();
  try {
    if (supabase) {
      await supabase.from('activity_logs').delete().eq('agency_id', agencyId);
    }
    window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
    return true;
  } catch {
    return false;
  }
}

function normalizeLog(row) {
  const details = row.details || {};
  return {
    id: row.id,
    type: row.action,
    description: details.description || row.action,
    timestamp: row.created_at,
    clientName: details.clientName || 'System',
  };
}
