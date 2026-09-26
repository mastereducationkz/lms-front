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

const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

/** Trims and strips ASCII control characters (so a tab or newline hidden inside a scheme,
 *  e.g. "java\tscript:", collapses to the plain scheme before we check it); null when the
 *  value isn't a string or nothing is left afterwards. */
function cleanedUrlInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARS_RE, '').trim();
  return cleaned || null;
}

/** The one relative shape both safe helpers accept: "/uploads/<key>" or bare "uploads/<key>",
 *  resolved onto `base` with `new URL()` — never by hand-concatenating the string — so a
 *  dot-segment (plain or percent-encoded: "/uploads/../../etc/x", "/uploads/%2e%2e/…")
 *  collapses before we check the *result* is still confined to "/uploads/". A value that
 *  climbs out of it, or that `new URL` can't parse at all, is rejected. */
function uploadPathUrl(cleaned: string, base: string): string | null {
  if (!/^\/?uploads\/.+/i.test(cleaned)) return null;
  try {
    // Strip any trailing slash(es) from `base` before adding our own: `new URL` treats a
    // base ending in "//" as having an empty path segment, which pushes the resolved
    // pathname to "//uploads/…" and fails the check below for no real reason.
    const resolved = new URL(cleaned.replace(/^\/+/, ''), `${base.replace(/\/+$/, '')}/`);
    return /^\/uploads\//i.test(resolved.pathname) ? resolved.href : null;
  } catch {
    return null;
  }
}

/** Parses `value` as an absolute http(s) URL, or null if it isn't one (wrong scheme,
 *  or `new URL` rejects it as malformed). */
function parseHttpUrl(value: string): URL | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * A stored FILE reference that came from an untrusted, user-supplied source — a student's
 * submission, draft or chat attachment — resolved to a URL the browser can load, or null
 * when the value cannot be trusted enough to load at all.
 *
 * Accepts only: a relative "/uploads/<key>" (or bare "uploads/<key>") path resolved onto
 * `base` and confined to staying under "/uploads/" there; or an absolute http(s) URL with
 * no userinfo whose host equals `base`'s host and whose path is likewise confined to
 * "/uploads/" (legacy absolute rows from before the API stored relative paths). Everything
 * else is rejected — another host, `javascript:`/`data:`/`blob:`/`vbscript:`,
 * protocol-relative "//…" (which inherits the page's own protocol and lets a value pick any
 * host), a backslash (browsers normalize `\` to `/` for http(s), so "\\evil.tld" parses
 * exactly like the protocol-relative case), userinfo (an "@" before the first "/" —
 * string-concatenating host + "@evil.tld/x" turns the intended host into userinfo and
 * evil.tld into the real one, and "https://attacker@base-host/…" hides a foreign login
 * behind a real host the browser still connects to as attacker@base-host), path traversal
 * out of "/uploads/" (plain or percent-encoded dot-segments), and control characters or
 * whitespace hidden inside a scheme name.
 */
export function safeUploadUrl(value: unknown, base: string = backendBase()): string | null {
  const cleaned = cleanedUrlInput(value);
  if (!cleaned || cleaned.includes('\\') || cleaned.startsWith('//')) return null;

  const uploadUrl = uploadPathUrl(cleaned, base);
  if (uploadUrl) return uploadUrl;

  const httpUrl = parseHttpUrl(cleaned);
  const baseUrl = parseHttpUrl(base);
  if (
    httpUrl &&
    baseUrl &&
    !httpUrl.username &&
    !httpUrl.password &&
    httpUrl.host.toLowerCase() === baseUrl.host.toLowerCase() &&
    /^\/uploads\//i.test(httpUrl.pathname)
  ) {
    return cleaned;
  }
  return null;
}

/**
 * A URL a person may legitimately point anywhere — a teacher's resource link, a
 * link-type answer — resolved for display, or null when it isn't safe to render as a
 * link at all.
 *
 * Allows any absolute http(s) URL (any host), plus the same "/uploads/" shape as
 * {@link safeUploadUrl}. Anything else — `javascript:`, `data:`, `blob:`, `vbscript:`,
 * protocol-relative "//…", a backslash, or a malformed value — returns null.
 */
export function safeLinkUrl(value: unknown, base: string = backendBase()): string | null {
  const cleaned = cleanedUrlInput(value);
  if (!cleaned || cleaned.includes('\\') || cleaned.startsWith('//')) return null;

  const uploadUrl = uploadPathUrl(cleaned, base);
  if (uploadUrl) return uploadUrl;

  return parseHttpUrl(cleaned) ? cleaned : null;
}

/**
 * The display file name for a stored URL/key: its last "/"-separated segment,
 * percent-decoded when that's a valid escape. Stored keys keep the raw upload filename,
 * so a literal "%" (e.g. "Screenshot 50%.png") is not a valid escape and
 * `decodeURIComponent` throws a `URIError` — this falls back to the raw segment instead
 * of letting one bad file name take a whole render down.
 */
export function fileNameFromUrl(url: string, fallback = 'file'): string {
  const rawName = url.split('/').pop() || fallback;
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}
