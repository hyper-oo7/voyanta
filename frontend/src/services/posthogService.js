// posthogService.js — Optional telemetry & product analytics integration.
// Gracefully tracks events when VITE_POSTHOG_KEY is defined in environment.

let posthogInstance = null;

export async function initPostHog() {
  const apiKey = import.meta.env?.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    return;
  }

  try {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default || posthogModule;
    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: true,
      capture_pageview: true,
      persistence: 'localStorage',
    });
    posthogInstance = posthog;
  } catch (err) {
    console.warn('[PostHog] Initialization error:', err);
  }
}

export function trackEvent(eventName, properties = {}) {
  if (posthogInstance) {
    try {
      posthogInstance.capture(eventName, properties);
    } catch (e) {
      console.warn('[PostHog] Event track error:', e);
    }
  }
}

export function identifyUser(userId, userProperties = {}) {
  if (posthogInstance && userId) {
    try {
      posthogInstance.identify(userId, userProperties);
    } catch (e) {
      console.warn('[PostHog] Identify error:', e);
    }
  }
}
