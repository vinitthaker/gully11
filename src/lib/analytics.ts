import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

let initialized = false;
const firedOnce = new Set<string>();

export function initAnalytics() {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_performance: false,
    persistence: 'localStorage',
  });

  initialized = true;
}

export function track(event: string, properties?: Record<string, string | number | boolean>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function trackOnce(event: string, properties?: Record<string, string | number | boolean>) {
  if (!initialized) return;
  const key = event + JSON.stringify(properties || {});
  if (firedOnce.has(key)) return;
  firedOnce.add(key);
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, email?: string) {
  if (!initialized) return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}
