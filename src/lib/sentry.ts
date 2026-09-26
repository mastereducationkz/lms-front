/**
 * Error reporting to Sentry, loaded lazily.
 *
 * Only the production image is built with a DSN: docker-compose passes `VITE_SENTRY_DSN` as a
 * build arg, and the deploy script adds the commit as `VITE_SENTRY_RELEASE`. `npm run dev`,
 * vitest and CI builds have no DSN, so everything here is a no-op there.
 *
 * `@sentry/react` is never imported statically here. `startSentry()` fetches it (through
 * `./sentryClient`, which names only what we use so the rest tree-shakes away) in an idle
 * callback after the first render, so the SDK lives in its own chunk and not in the entry
 * bundle. Errors thrown before it arrives are buffered (a few) and sent once it has.
 *
 * Privacy rules (the owner's decision): no names, emails, IPs, cookies or request bodies. The
 * user is the numeric id plus the role. Download/watch tokens live in URL paths, and query
 * strings carry search terms and one-time codes, so every URL is scrubbed before it leaves.
 * Errors only: no tracing.
 */
import type { Breadcrumb, BreadcrumbHint, ErrorEvent, EventHint } from '@sentry/react';

type SentrySdk = typeof import('./sentryClient');

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || '';
const ENVIRONMENT = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() || 'production';
const RELEASE = (import.meta.env.VITE_SENTRY_RELEASE as string | undefined)?.trim() || '';

export const FILTERED = '[Filtered]';

// A path segment after one of these is a bearer credential (see lms-backend sentry_setup.py,
// which scrubs the same routes): /uploads/v/<token>/…, /class-materials/download/<token>,
// /watch-links/<token>, the SPA's /watch/:token page, calendar feeds, Telegram links.
const TOKEN_PATH_RE =
  /(\/(?:uploads\/v|class-materials\/download|watch-links|watch|calendar\/feeds\/me|tg\/l|push-tokens)\/)[^/?#\s"']+/g;
// Any other long opaque segment: a JWT, a presigned key. (No lookbehind: this module is in the
// entry bundle, and Safari before 16.4 fails to parse one, which would blank the whole app.)
const LONG_SEGMENT_RE = /\/[A-Za-z0-9_\-.~=%]{40,}(?=[/?#\s"']|$)/g;
const QUERY_RE = /\?[^#\s"']*/g;
const FRAGMENT_RE = /#[^\s"']*/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Secrets that can sit anywhere: user:password@ in a URL, a JWT (media and class-material
// tokens are JWTs), "Bearer <token>".
const USERINFO_RE = /(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const BEARER_RE = /(\b(?:bearer|token)\s+)[A-Za-z0-9._~+/=-]{16,}/gi;

function scrubSecrets(text: string): string {
  return text
    .replace(USERINFO_RE, (_m, scheme: string) => `${scheme}${FILTERED}@`)
    .replace(JWT_RE, FILTERED)
    .replace(BEARER_RE, (_m, prefix: string) => prefix + FILTERED);
}
const URL_IN_TEXT_RE = /https?:\/\/[^\s"'<>]+/g;

export function scrubUrl<T>(url: T): T {
  if (typeof url !== 'string' || !url) return url;
  return scrubSecrets(url)
    .replace(FRAGMENT_RE, '')
    .replace(QUERY_RE, `?${FILTERED}`)
    .replace(TOKEN_PATH_RE, (_m, prefix: string) => prefix + FILTERED)
    .replace(LONG_SEGMENT_RE, `/${FILTERED}`)
    .replace(EMAIL_RE, FILTERED) as T;
}

export function scrubText<T>(text: T): T {
  if (typeof text !== 'string' || !text) return text;
  return scrubSecrets(text)
    .replace(URL_IN_TEXT_RE, (u) => scrubUrl(u))
    .replace(TOKEN_PATH_RE, (_m, prefix: string) => prefix + FILTERED)
    .replace(EMAIL_RE, FILTERED) as T;
}

// Browser noise that is never our bug, or is already handled:
// - ResizeObserver: a benign spec warning some browsers surface as an error.
// - Chunk loads after a deploy: src/services/pwa.ts reloads the tab onto the new build. When
//   its once-per-30-s guard skips the reload, React.lazy receives undefined and says so.
// - "Missing refresh token": the session ended; the client sends the user to log in.
// - Network failures and aborted requests: the user's connection, not the app. Server faults
//   are reported by the backend's own Sentry project.
const IGNORED_MESSAGES: RegExp[] = [
  /ResizeObserver loop/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Expected the result of a dynamic import/i,
  /^Missing refresh token$/,
  /^Network Error$/i,
  /^(Request aborted|canceled)$/i,
  /^Load failed$/i,
  /^Failed to fetch$/i,
];
const IGNORED_TYPES = new Set(['AbortError', 'CanceledError', 'ChunkLoadError', 'AxiosError']);
const EXTENSION_URL_RE = /^(chrome|moz|safari(-web)?|ms-browser)-extension:\/\/|^webkit-masked-url:/i;

function exceptionValues(event: ErrorEvent) {
  return event.exception?.values ?? [];
}

/** True when the event is noise we deliberately never report. */
export function isIgnoredEvent(event: ErrorEvent, hint?: EventHint): boolean {
  const original = hint?.originalException as { name?: string; isAxiosError?: boolean; message?: string } | undefined;
  if (original && typeof original === 'object') {
    if (original.isAxiosError) return true;
    if (original.name && IGNORED_TYPES.has(original.name)) return true;
  }
  const values = exceptionValues(event);
  const texts = [event.message ?? '', ...values.map((v) => v.value ?? '')];
  if (values.some((v) => v.type && IGNORED_TYPES.has(v.type))) return true;
  if (texts.some((t) => IGNORED_MESSAGES.some((re) => re.test(t)))) return true;
  // Every script of ours is served from /assets/. A stack with no frame there was thrown by
  // something injected into the page: an extension, or the Telegram/Instagram in-app browser
  // many students open links in (the SAT front learned this one: sentryEventFilter.js).
  const frames = values.flatMap((v) => v.stacktrace?.frames ?? []);
  if (frames.length > 0 && !frames.some((f) => /\/assets\//.test(f.filename ?? ''))) return true;
  if (frames.length > 0 && frames.every((f) => EXTENSION_URL_RE.test(f.filename ?? ''))) return true;
  // No stack and a bare 1-4 letter "message" (`Error: Ea`): minified injected code, not ours.
  if (frames.length === 0 && values.some((v) => /^[A-Za-z]{1,4}$/.test(v.value ?? ''))) return true;
  // A cross-origin script error carries no information at all.
  if (!values.length && /^Script error\.?$/i.test(event.message ?? '')) return true;
  return false;
}

function scrubBreadcrumbInPlace(crumb: Breadcrumb): void {
  if (crumb.message) crumb.message = scrubText(crumb.message);
  const data = crumb.data;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = scrubUrl(data[key]);
    }
    delete data['http.query'];
    delete data['http.fragment'];
    // console.* arguments can be whole API responses with names in them.
    delete data.arguments;
  }
}

export function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isIgnoredEvent(event, hint)) return null;
  if (event.request) {
    const { url, headers } = event.request;
    event.request = {
      url: scrubUrl(url),
      headers: headers
        ? Object.fromEntries(
            Object.entries(headers)
              .filter(([k]) => ['user-agent', 'referer'].includes(k.toLowerCase()))
              .map(([k, v]) => [k, k.toLowerCase() === 'referer' ? scrubUrl(v) : v]),
          )
        : undefined,
    };
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.message) event.message = scrubText(event.message);
  for (const value of exceptionValues(event)) {
    if (value.value) value.value = scrubText(value.value);
  }
  for (const crumb of event.breadcrumbs ?? []) scrubBreadcrumbInPlace(crumb);
  if (event.user) event.user = event.user.id != null ? { id: event.user.id } : undefined;
  return event;
}

export function beforeBreadcrumb(crumb: Breadcrumb, _hint?: BreadcrumbHint): Breadcrumb | null {
  // Only warnings and errors from the console; log/info/debug lines are chatty and may print data.
  if (crumb.category === 'console' && crumb.level !== 'error' && crumb.level !== 'warning') return null;
  // hls.js fetches every video segment through /uploads/v/…: one crumb per segment would push
  // everything useful out of the 50-crumb buffer during playback.
  if ((crumb.category === 'xhr' || crumb.category === 'fetch') && /\/uploads\/v\//.test(String(crumb.data?.url ?? ''))) {
    return null;
  }
  scrubBreadcrumbInPlace(crumb);
  return crumb;
}

// ---------------------------------------------------------------- lazy loading

let sdk: SentrySdk | null = null;
let started = false;
const MAX_BUFFERED = 10;
const buffered: Array<{ error: unknown; extra?: Record<string, unknown> }> = [];
let currentUser: { id: string; role?: string } | null = null;

export function sentryConfigured(): boolean {
  if (!DSN || import.meta.env.MODE === 'test') return false;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return host !== 'localhost' && host !== '127.0.0.1';
}

function bufferError(error: unknown, extra?: Record<string, unknown>) {
  if (buffered.length < MAX_BUFFERED) buffered.push({ error, extra });
}

function onEarlyError(e: Event) {
  const { error, message } = e as Event & { error?: unknown; message?: string };
  bufferError(error ?? message);
}
function onEarlyRejection(e: PromiseRejectionEvent) {
  bufferError(e.reason);
}

function applyUser(s: SentrySdk) {
  s.setUser(currentUser ? { id: currentUser.id } : null);
  s.setTag('role', currentUser?.role ?? undefined);
}

function init(s: SentrySdk) {
  s.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE && RELEASE !== 'unknown' ? RELEASE : undefined,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // No tracesSampleRate at all: errors only. Setting it, even to 0, turns tracing on.
    maxBreadcrumbs: 50,
    ignoreErrors: IGNORED_MESSAGES,
    denyUrls: [EXTENSION_URL_RE],
    beforeSend,
    beforeBreadcrumb,
  });
  sdk = s;
  window.removeEventListener('error', onEarlyError);
  window.removeEventListener('unhandledrejection', onEarlyRejection);
  applyUser(s);
  for (const { error, extra } of buffered.splice(0)) s.captureException(error, extra ? { extra } : undefined);
}

/** Loads and starts the SDK when the browser is idle. Safe to call more than once. */
export function startSentry(): void {
  if (started || !sentryConfigured()) return;
  started = true;
  window.addEventListener('error', onEarlyError);
  window.addEventListener('unhandledrejection', onEarlyRejection);
  const load = () => {
    import('./sentryClient').then(init).catch(() => {
      // An ad blocker or a flaky network kept the SDK away. Reporting is best effort.
      window.removeEventListener('error', onEarlyError);
      window.removeEventListener('unhandledrejection', onEarlyRejection);
      buffered.length = 0;
    });
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (idle) idle(load, { timeout: 5000 });
  else window.setTimeout(load, 2000);
}

/** Report an error the app caught itself (the ErrorBoundary). */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!sentryConfigured()) return;
  if (sdk) sdk.captureException(error, extra ? { extra } : undefined);
  else bufferError(error, extra);
}

/** Who is signed in: the numeric id and the role, nothing else. */
export function setSentryUser(user: { id: number | string; role?: string | null } | null): void {
  currentUser = user ? { id: String(user.id), role: user.role ?? undefined } : null;
  if (sdk) applyUser(sdk);
}
