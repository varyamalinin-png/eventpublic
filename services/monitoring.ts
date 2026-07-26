import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let Sentry: any = null;

export async function initMonitoring() {
  if (!SENTRY_DSN || Platform.OS === 'web') return;

  try {
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
    });
  } catch {
    // Sentry not installed — skip
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (Sentry) {
    Sentry.captureException(error, { extra: context });
  }
}

export function setUser(userId: string, email?: string) {
  if (Sentry) {
    Sentry.setUser({ id: userId, email });
  }
}
