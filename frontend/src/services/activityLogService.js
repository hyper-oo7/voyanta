// Activity log service — writes to Supabase activity_logs table.
// Falls back gracefully to localStorage if Supabase is unavailable.
import { supabase, getAgencyId } from '../lib/supabaseClient.js';

const PAGE_SIZE = 50;
const LOCAL_STORAGE_KEY = 'voyanta_activity_logs';

function getLocalLogs() {
  try {
    const str = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = JSON.parse(str || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLogs(logs) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch {}
}

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
      if (!error && data) {
        const norm = data.map(normalizeLog);
        saveLocalLogs(norm);
        return norm;
      }
    } catch (e) {
      console.warn('getActivityLogs Supabase error, using localStorage:', e);
    }
  }
  return getLocalLogs().slice(0, limit);
}

export async function logActivity(type, description, clientName = 'Agency Team', entityType = null, entityId = null) {
  const agencyId = getAgencyId();
  const logItem = {
    id: crypto.randomUUID(),
    type,
    description,
    timestamp: new Date().toISOString(),
    clientName: clientName || 'System',
    entity_type: entityType,
    entity_id: entityId,
  };

  if (supabase) {
    try {
      let userId = null;
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
    } catch (err) {
      console.warn('Supabase logActivity failed, saving to localStorage:', err);
    }
  }

  const local = getLocalLogs();
  local.unshift(logItem);
  saveLocalLogs(local);

  window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
  return logItem;
}

export async function clearActivityLogs() {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      await supabase.from('activity_logs').delete().eq('agency_id', agencyId);
    } catch {}
  }
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
  return true;
}

function normalizeLog(row) {
  const details = row.details || {};
  return {
    id: row.id,
    type: row.action || row.type || 'activity',
    description: details.description || row.description || row.action || 'Activity recorded',
    timestamp: row.created_at || row.timestamp || new Date().toISOString(),
    clientName: details.clientName || row.clientName || 'System',
  };
}
