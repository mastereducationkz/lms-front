/**
 * How often a feature is actually used (lms-backend `POST /usage`, one counter row per person,
 * feature, action and Almaty day). Fire-and-forget: a counter must never break or slow a page,
 * so every failure is swallowed.
 */
import { api } from './client';

export function reportUsage(feature: string, action: string, count = 1): void {
  try {
    api.post('/usage', { feature, action, count }).catch(() => undefined);
  } catch {
    // An offline or misconfigured client: nothing to count.
  }
}
