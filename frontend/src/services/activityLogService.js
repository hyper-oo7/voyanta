const LOGS_KEY = 'voyanta_activity_logs';

export function getActivityLogs() {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) {
      // Seed with some initial welcome log if empty
      return [
        {
          id: 'log_init',
          type: 'system',
          description: 'Agency environment initialized and ready.',
          timestamp: new Date().toISOString(),
          clientName: 'System'
        }
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function logActivity(type, description, clientName = 'Agency Team') {
  try {
    const logs = getActivityLogs();
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type, // 'proposal', 'pdf', 'approval', 'modification', 'subscription', 'team', 'system'
      description,
      timestamp: new Date().toISOString(),
      clientName
    };
    const updated = [newLog, ...logs].slice(0, 50); // keep last 50
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
    return newLog;
  } catch (err) {
    console.error('Failed to log activity:', err);
    return null;
  }
}

export function clearActivityLogs() {
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('voyanta:activity-log-updated'));
    return true;
  } catch {
    return false;
  }
}
