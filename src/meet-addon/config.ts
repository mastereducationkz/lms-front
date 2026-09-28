/**
 * Build-time settings of the Google Meet add-on panel (`/meet-addon.html`).
 *
 * The panel is its own small entry: it never loads the main app's router, auth context or API
 * client. It talks to the same backend, with a Bearer token of its own (see `tokens.ts`).
 */

/** The API base, upgraded to https the way the main client does (`services/api/client.ts`). */
export function apiBase(raw: string | undefined, pageProtocol: string): string {
  const base = (raw || 'http://localhost:8000').replace(/\/+$/, '');
  if (/^http:\/\/lmsapi\.mastereducation\.kz/.test(base)) return base.replace('http://', 'https://');
  if (pageProtocol === 'https:' && base.startsWith('http://')) return base.replace('http://', 'https://');
  return base;
}

export const API_BASE = apiBase(
  import.meta.env.VITE_BACKEND_URL as string | undefined,
  typeof window !== 'undefined' ? window.location.protocol : 'http:',
);

/** The Google Cloud project that owns the add-on; Meet refuses a session without it. */
export const CLOUD_PROJECT_NUMBER = String(import.meta.env.VITE_MEET_ADDON_PROJECT_NUMBER ?? '').trim();

/** Where «Open in LMS» goes: the site that served the panel (lms.mastereducation.kz in production). */
export function lessonUrl(id: number): string {
  return `${window.location.origin}/lessons/${id}`;
}
