// Uploaded files are stored as paths on the API host ("/uploads/questions/…" — see the backend's
// storage_service.save), never as full URLs. A page on the frontend host that puts such a path
// straight into <img src> asks nginx for it, gets the app's HTML back, and shows nothing at all
// (an <img alt=""> that failed to load is invisible). Every place that shows an uploaded file has
// to spell the API host out first; this is the one function for that.

const DEFAULT_BACKEND = 'http://localhost:8000';

/** The API host, without a trailing slash; upgraded to https on an https page, where http media is blocked. */
export function backendBase(
  raw: string = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND,
  pageProtocol: string | undefined = typeof window !== 'undefined' ? window.location.protocol : undefined,
): string {
  const base = raw.trim().replace(/\/+$/, '');
  return pageProtocol === 'https:' && base.startsWith('http://') ? `https://${base.slice('http://'.length)}` : base;
}

/**
 * A stored media path as a URL the browser can load: full URLs (http, https, protocol-relative,
 * data:, blob:) pass through untouched, anything else is a path on the API host. Null when there
 * is nothing to load.
 */
export function mediaUrl(path: unknown, base: string = backendBase()): string | null {
  if (typeof path !== 'string') return null;
  const value = path.trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith('//')) return value;
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
}
