/**
 * What never reaches Sentry (browser noise), and which failed API calls do, and how many.
 *
 * Until 2026-10 every AxiosError was dropped. Only an error nobody caught (an unhandled
 * rejection, an ErrorBoundary) reaches Sentry at all, so each of those was most likely a screen
 * that broke, and the class hid real defects: a 502/503/504 from nginx while the backend was down
 * or redeploying (the backend's own Sentry never sees those), a 400/422 when the client and the
 * API disagree, a 404 after a deploy, the 20 s axios timeout behind the silent upload failures.
 *
 * The organisation's error quota is 5 000 events a month, shared by four products, so:
 * - never reported: a cancelled request, a 401 (the client refreshes the session and logs the
 *   user in again), anything while the browser says it is offline, and a request that got no
 *   answer at all (`ERR_NETWORK`: a flaky phone connection far more often than our CORS list);
 * - reported once per fingerprint per page load, at most `MAX_REPORTS_PER_PAGE` in all;
 * - a 5xx is reported for a quarter of page loads, so an outage costs about a quarter of the
 *   open tabs, not all of them.
 *
 * The fingerprint is `['axios', METHOD, route, status|code]`. The route is built from a URL the
 * caller has already put through `scrubUrl` (sentry.ts), then cut down to its static words: no
 * origin, query or fragment, and every segment that is not a plain word (an id, an email, a
 * token, a file name) becomes `:id`.
 */

import type { ErrorEvent, EventHint } from '@sentry/react';

export interface AxiosLike {
  isAxiosError?: boolean;
  code?: string;
  config?: { method?: string; url?: string };
  response?: { status?: number };
}

export const MAX_REPORTS_PER_PAGE = 5;
export const SERVER_ERROR_SAMPLE_RATE = 0.25;

const ROUTE_MAX_LENGTH = 120;
const ORIGIN_RE = /^[a-z][a-z0-9+.-]{0,20}:\/\/[^/?#]*/i;
// A plain word: what a route's static part is made of. Anything else is data.
const STATIC_SEGMENT_RE = /^[a-z_-]{1,32}$/i;
const METHOD_RE = /^[A-Z]{3,7}$/;
const CODE_RE = /^[A-Z_]{1,40}$/;

export function asAxiosError(value: unknown): AxiosLike | null {
  return value && typeof value === 'object' && (value as AxiosLike).isAxiosError ? (value as AxiosLike) : null;
}

/** The failed API call behind an error: the AxiosError itself, or the one an API wrapper kept as
 * the `cause` of the plain Error it rethrew (`apiError`, src/services/api/apiError.ts). */
export function axiosErrorOf(value: unknown): AxiosLike | null {
  return asAxiosError(value) ?? asAxiosError((value as { cause?: unknown } | null | undefined)?.cause);
}

export function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** The rule a failed call is never reported under (its name goes in `dropped_by`), or null. */
export function ignoredAxiosRule(error: AxiosLike, online: boolean): string | null {
  if (error.code === 'ERR_CANCELED') return 'axios_canceled';
  if (!online) return 'axios_offline';
  const status = error.response?.status;
  if (status === 401) return 'axios_401';
  if (status === undefined && error.code === 'ERR_NETWORK') return 'axios_network';
  return null;
}

/** `/courses/12/lessons/45?x=1` → `/courses/:id/lessons/:id`. Takes an already scrubbed URL. */
export function routeTemplate(scrubbedUrl: string): string {
  const path = scrubbedUrl.replace(ORIGIN_RE, '').split(/[?#]/, 1)[0];
  const route = path
    .split('/')
    .map((segment) => (segment === '' || STATIC_SEGMENT_RE.test(segment) ? segment : ':id'))
    .join('/');
  return (route.startsWith('/') ? route : `/${route}`).slice(0, ROUTE_MAX_LENGTH);
}

export function axiosFingerprint(error: AxiosLike, scrubbedUrl: string): string[] {
  const method = String(error.config?.method || 'get').toUpperCase();
  const status = error.response?.status;
  const code = String(error.code || '');
  return [
    'axios',
    METHOD_RE.test(method) ? method : 'OTHER',
    routeTemplate(scrubbedUrl),
    typeof status === 'number' ? String(status) : CODE_RE.test(code) ? code : 'unknown',
  ];
}

/** Why a reportable failed call was still not sent, or 'send'. */
export type Admission = 'send' | 'repeat' | 'sampled_out' | 'budget';

/** One page load's reporting budget. A full reload starts a fresh one. */
export class AxiosReportBudget {
  private seen = new Set<string>();
  private sent = 0;

  constructor(private readonly max = MAX_REPORTS_PER_PAGE) {}

  admit(fingerprint: string[], status: number | undefined, random: () => number = Math.random): Admission {
    const key = fingerprint.join(' ');
    if (this.seen.has(key)) return 'repeat';
    // Remembered before the dice: a 5xx is decided once per page load, not re-rolled until it wins.
    this.seen.add(key);
    if (typeof status === 'number' && status >= 500 && random() >= SERVER_ERROR_SAMPLE_RATE) return 'sampled_out';
    if (this.sent >= this.max) return 'budget';
    this.sent += 1;
    return 'send';
  }

  reset(): void {
    this.seen.clear();
    this.sent = 0;
  }
}

export const axiosReports = new AxiosReportBudget();

// ---------------------------------------------------------------- noise

// Browser noise that is never our bug, or is already handled:
// - ResizeObserver: a benign spec warning some browsers surface as an error.
// - Chunk loads after a deploy: src/services/pwa.ts reloads the tab onto the new build. When
//   its once-per-30-s guard (or the OIDC callback route) skips the reload, src/lib/lazyRoute.ts
//   throws this ChunkLoadError instead of letting React.lazy crash on an undefined module.
// - "Missing refresh token": the session ended; the client sends the user to log in.
// - Network failures and aborted requests: the user's connection, not the app. A failed axios
//   call is decided by the axios rules above, never by these.
// Applied in beforeSend only (not also as `ignoreErrors`), so the dropped_by sample sees them.
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
const IGNORED_TYPES = new Set(['AbortError', 'CanceledError', 'ChunkLoadError']);
export const EXTENSION_URL_RE = /^(chrome|moz|safari(-web)?|ms-browser)-extension:\/\/|^webkit-masked-url:/i;
// Telegram's in-app browser injects a WebView JS bridge; calling a bridge method the host app
// doesn't support throws this exact message. It's never our code, but unlike the minified
// noise above it reads like a real sentence, so the bare-1-4-letter check below doesn't catch
// it — it needs its own rule, still gated on the frames not being ours (see isIgnoredEvent).
const SENTRY_CHUNK_RE = /\/assets\/sentryClient-/;
const POSTEVENT_BRIDGE_RE = /^Error invoking postEvent:/;

export function exceptionValues(event: ErrorEvent) {
  return event.exception?.values ?? [];
}

/** True when the event is noise we deliberately never report. */
export function isIgnoredEvent(event: ErrorEvent, hint?: EventHint): boolean {
  return ignoredBy(event, hint) !== null;
}

/** The rule that marks the event as noise (sent as `dropped_by` with the 1% sample), or null. */
export function ignoredBy(event: ErrorEvent, hint?: EventHint): string | null {
  // A failed API call is decided by the axios rules alone: its stack can be all axios/native
  // frames, which the frame rules below would take for injected code.
  const axiosError = axiosErrorOf(hint?.originalException);
  if (axiosError) return ignoredAxiosRule(axiosError, browserOnline());
  const original = hint?.originalException as { name?: string; message?: string } | undefined;
  if (original && typeof original === 'object' && original.name && IGNORED_TYPES.has(original.name)) {
    return `type:${original.name}`;
  }
  const values = exceptionValues(event);
  const texts = [event.message ?? '', ...values.map((v) => v.value ?? '')];
  const ignoredType = values.find((v) => v.type && IGNORED_TYPES.has(v.type))?.type;
  if (ignoredType) return `type:${ignoredType}`;
  const ignoredMessage = IGNORED_MESSAGES.find((re) => texts.some((t) => re.test(t)));
  if (ignoredMessage) return `message:${ignoredMessage.source.slice(0, 50)}`;
  // Every script of ours is served from /assets/. A stack with no frame there was thrown by
  // something injected into the page: an extension, or the Telegram/Instagram in-app browser
  // many students open links in (the SAT front learned this one: sentryEventFilter.js).
  const frames = values.flatMap((v) => v.stacktrace?.frames ?? []);
  // The Sentry chunk (sentryClient-<hash>.js) is served from /assets/ too, and its
  // browserapierrors wrapper sits on the stack of every error thrown from a setTimeout/
  // addEventListener callback — including the injected Telegram bridge's (LMS-FRONT-3, whose
  // whole stack was that wrapper plus `<anonymous>`). It's Sentry's frame, not ours.
  const hasOurFrame = frames.some((f) => /\/assets\//.test(f.filename ?? '') && !SENTRY_CHUNK_RE.test(f.filename ?? ''));
  if (frames.length > 0 && !hasOurFrame) return 'no_app_frame';
  if (frames.length > 0 && frames.every((f) => EXTENSION_URL_RE.test(f.filename ?? ''))) return 'extension_frames';
  // No stack and a bare 1-4 letter "message" (`Error: Ea`): minified injected code, not ours.
  if (frames.length === 0 && values.some((v) => /^[A-Za-z]{1,4}$/.test(v.value ?? ''))) return 'bare_identifier';
  // Telegram's postEvent bridge (see POSTEVENT_BRIDGE_RE above): only when it's not already
  // caught above by having a stack with no frame in our bundle (frames.length === 0 is the
  // uncaught case — the observed report had no stack at all). A real error with this exact
  // text thrown from OUR code (a frame under /assets/) must still report.
  if (!hasOurFrame && texts.some((t) => POSTEVENT_BRIDGE_RE.test(t))) return 'telegram_bridge';
  // A cross-origin script error carries no information at all.
  if (!values.length && /^Script error\.?$/i.test(event.message ?? '')) return 'script_error';
  return null;
}
