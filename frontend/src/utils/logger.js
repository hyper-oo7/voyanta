const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

const isDev = import.meta.env.MODE === 'development';
const isLoggingEnabled = import.meta.env.VITE_ENABLE_LOGGING !== 'false';

let sentryInitialized = false;
let Sentry = null;

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import('@sentry/react').then((module) => {
    Sentry = module;
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 0.2,
    });
    sentryInitialized = true;
  }).catch(() => {
    // Sentry SDK not installed or failed to load; continue silently without errors
  });
}

function log(level, message, ...data) {
  if (!isLoggingEnabled && !isDev) return; // Disable in prod unless explicitly enabled

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  switch (level) {
    case LOG_LEVELS.INFO:
      console.log(prefix, message, ...data);
      break;
    case LOG_LEVELS.WARN:
      console.warn(prefix, message, ...data);
      break;
    case LOG_LEVELS.ERROR:
      console.error(prefix, message, ...data);
      if (sentryInitialized && Sentry) {
        try {
          if (message instanceof Error) {
            Sentry.captureException(message, { extra: { data } });
          } else {
            Sentry.captureMessage(String(message), { level: 'error', extra: { data } });
          }
        } catch {}
      }
      break;
    default:
      console.log(prefix, message, ...data);
  }
}

export const logger = {
  info: (msg, ...data) => log(LOG_LEVELS.INFO, msg, ...data),
  warn: (msg, ...data) => log(LOG_LEVELS.WARN, msg, ...data),
  error: (msg, ...data) => log(LOG_LEVELS.ERROR, msg, ...data),
  captureException: (err, extra = {}) => {
    if (sentryInitialized && Sentry) {
      try { Sentry.captureException(err, { extra }); } catch {}
    }
  }
};

