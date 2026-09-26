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
 * Privacy rules (WS9, the owner's "unmasking" decision, 2026-09-26): the owner needs to see WHO
 * an error affected, so the user's id, email, name and role, the client IP, and the request
 * URL/method/query string are all visible. What stays masked, always: passwords, every kind of
 * token (JWTs, download/watch/class-material/calendar/telegram tokens in URL paths, presigned S3
 * query strings, and secret-named query params such as token/code/sig/key/secret/password/auth),
 * URL userinfo, and Authorization/Cookie-style credentials. See `scrubUrl`/`scrubText` for the
 * exact rules. Errors only: no tracing today (`buildSentryInitOptions` sets no
 * `tracesSampleRate`/`tracesSampler`) — `beforeSendTransaction`/`beforeSendSpan` are registered
 * anyway (WS9 Addendum B) so tracing can be turned on later without silently shipping an
 * unscrubbed transaction/span path; see the SAT incident referenced on `beforeSendTransaction`.
 */
import type { Breadcrumb, BreadcrumbHint, ErrorEvent, EventHint, RequestEventData } from '@sentry/react';
// `TransactionEvent`/`SpanJSON`/`QueryParams` aren't re-exported by `@sentry/react` (or
// `@sentry/browser`) itself, only by the `@sentry/core` they're both built on — type-only, so
// this is erased entirely at build time and adds nothing to the lazy chunk (see sentryClient.ts's
// own comment on why VALUE imports here matter and type imports don't).
import type { QueryParams, SpanJSON, TransactionEvent } from '@sentry/core';

type SentrySdk = typeof import('./sentryClient');

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || '';
const ENVIRONMENT = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() || 'production';
const RELEASE = (import.meta.env.VITE_SENTRY_RELEASE as string | undefined)?.trim() || '';

export const FILTERED = '[Filtered]';

// Perf backstop (fix round 2): an error/breadcrumb string is attacker- or bug-influenced input
// (a URL, a log line), and several of the regexes below are, in the worst case, quadratic on
// pathological input — 60 KB of repeated "eyJ" (no real dot ever appears, so JWT_RE backtracks
// to the end and back at every position) measured over 10s. Truncating BEFORE any regex runs
// bounds every pattern's worst case at once, current and future, rather than hardening each one
// individually. 2 KB is generous for anything this app actually produces (URLs and log lines are
// a few hundred characters at most) and keeps the worst case comfortably under budget — see the
// "adversarial input" perf tests below.
const MAX_SCRUB_LENGTH = 2048;
const TRUNCATION_MARKER = '…[truncated]';
// Characters a secret is typically built from (base64url, hex, a URL scheme/userinfo/path
// segment): letters, digits, and this punctuation. Used only to back a hard cut off a dangling
// partial secret — see capLength.
const TOKEN_CHAR_RE = /[A-Za-z0-9._~+/=%:@-]/;
/**
 * Slices to MAX_SCRUB_LENGTH, then backs off any trailing run of token-ish characters, so a
 * secret can never be left half-cut for a downstream regex to fail to recognize. Two concrete
 * failures a bare slice caused (fix round 3): a long opaque segment landing 1-39 chars short of
 * LONG_SEGMENT_RE's 40-char minimum printed in full; a userinfo URL cut between the `:` and the
 * `@` left the password visible, since USERINFO_RE can't match without that `@`.
 *
 * Returns `[text, wasTruncated]` rather than appending the marker itself — the caller must scrub
 * FIRST and append the marker AFTER (see scrubUrlImpl/scrubText). Appending it before scrubbing
 * (the fix round 2 shape) planted "…[truncated]" — none of `/?#\s"'`, none of them `$` either,
 * since more text used to follow — exactly where LONG_SEGMENT_RE's own `(?=[/?#\s"']|$)`
 * lookahead needed to find one of those, so a straddling secret's masking silently failed too.
 */
function capLength(text: string): [text: string, wasTruncated: boolean] {
  if (text.length <= MAX_SCRUB_LENGTH) return [text, false];
  let end = MAX_SCRUB_LENGTH;
  while (end > 0 && TOKEN_CHAR_RE.test(text[end - 1])) end--;
  return [text.slice(0, end), true];
}

// A path segment after one of these is a bearer credential (see lms-backend sentry_setup.py,
// which scrubs the same routes): /uploads/v/<token>/…, /uploads/s/<token>/…,
// /class-materials/download/<token>, /watch-links/<token>, the SPA's /watch/:token page,
// calendar feeds, Telegram links.
const TOKEN_PATH_RE =
  /(\/(?:uploads\/v|uploads\/s|class-materials\/download|watch-links|watch|calendar\/feeds\/me|tg\/l|push-tokens)\/)[^/?#\s"']+/g;
// Any other long opaque segment: a JWT, a presigned key. (No lookbehind: this module is in the
// entry bundle, and Safari before 16.4 fails to parse one, which would blank the whole app.)
const LONG_SEGMENT_RE = /\/[A-Za-z0-9_\-.~=%]{40,}(?=[/?#\s"']|$)/g;
const QUERY_RE = /\?[^#\s"']*/g;
const FRAGMENT_RE = /#[^\s"']*/g;
// Secrets that can sit anywhere: user:password@ in a URL, a JWT (media and class-material
// tokens are JWTs), "Bearer <token>", a Telegram bot token (api.telegram.org/bot<id>:<secret>/…).
// The scheme and each JWT segment are bounded ({0,20}/{5,200}), not unbounded (`*`/`{5,}`): a
// real URL scheme or JWT segment never gets remotely that long, and bounding the backtrack range
// is a second, independent layer under the MAX_SCRUB_LENGTH cap above.
const USERINFO_RE = /(\b[a-z][a-z0-9+.-]{0,20}:\/\/)[^/\s:@]+:[^/\s@]+@/gi;
// No leading `\b`: it fails between two word characters (`_` counts as one), so a token glued
// onto a preceding word — "prefix_eyJ…" — would otherwise not match at all.
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,200}\.[A-Za-z0-9_-]{5,200}\.[A-Za-z0-9_-]{0,200}/g;
const BEARER_RE = /(\b(?:bearer|token)\s+)[A-Za-z0-9._~+/=-]{16,}/gi;
const TELEGRAM_BOT_RE = /(\/bot)\d+:[A-Za-z0-9_-]+/g;
// Query params whose VALUE is always a secret; the name stays visible. Case-insensitive.
// `switch` (Addendum B): the sibling-platform switch link's own one-time param, alongside the
// handoff/SSO `token`/`code` already here — `#switch=…` isn't stripped by FRAGMENT_RE the way an
// absolute URL's fragment is, since a relative one (a span description, a log line) never reaches
// scrubUrl's own fragment handling at all, only this name-based pass.
const SECRET_PARAM_RE =
  /^(token|access_token|refresh_token|id_token|code|sig|signature|key|api_key|apikey|secret|password|auth|switch)$/i;
// A presigned S3/SigV4 URL carries the whole credential in the query string, not one param —
// mask the query in one piece rather than trying to name every AWS param.
const PRESIGNED_QUERY_RE = /(?:^|[?&])(?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|Signature)=/i;
// A value containing this has a decodable nested path/URL worth inspecting on its own — e.g.
// `?next=%2Freset-password%3Ftoken%3DX` decodes to `/reset-password?token=X`.
const NESTED_ENCODING_HINT_RE = /%2f|%3f/i;
// A blunt, structure-agnostic pass over `[?&;#]<name>=<value>`, absolute URL or not, well-formed
// or not (a relative path in a log message, a query nested inside another query's value, a `;`
// separator). Unlike scrubQueryString's precise top-level-query handling, this one doesn't know
// or care what "the query" is — it just finds every param-shaped thing in the whole string. The
// name/value character classes exclude the separators and the `=` they need next, so there's
// nothing for either quantifier to backtrack over: each one either finds what it needs immediately
// or fails immediately, never combinatorially.
//
// The value class does NOT exclude `?` (fix round 3): a secret name's value must be masked
// through to the next real separator, INCLUDING a `?` — `/x?token=abc?SECRET` used to become
// `?token=[Filtered]?SECRET` because the old value class stopped at that `?`, leaking SECRET.
// scrubAnyParams itself still has to tell a literal nested query (`?next=/x?token=Y`, no
// percent-encoding, round 1's own test) apart from a secret value that merely contains a `?`: it
// only widens past a `?` when the NAME it just matched is secret; for a non-secret name it splits
// the captured value at the first `?` and re-runs itself on everything from there on, so the
// nested `?token=Y` still gets found and masked as its own param instead of being swallowed
// silently into `next`'s (non-secret) value.
const ANY_PARAM_RE = /([?&;#])([^=&;#?\s"'<>]+)=([^&;#\s"'<>]*)/g;

function scrubSecrets(text: string): string {
  return text
    .replace(USERINFO_RE, (_m, scheme: string) => `${scheme}${FILTERED}@`)
    .replace(JWT_RE, FILTERED)
    .replace(BEARER_RE, (_m, prefix: string) => prefix + FILTERED)
    .replace(TELEGRAM_BOT_RE, (_m, prefix: string) => prefix + FILTERED);
}
const URL_IN_TEXT_RE = /https?:\/\/[^\s"'<>]+/g;

/**
 * Percent-decodes (defensively) and strips a `parent[child]` wrapper before testing the name.
 * Plain string ops (lastIndexOf/indexOf/slice), not a `/\[([^\]]*)\]\s*$/`-style regex: that
 * shape is exactly the other catastrophic-backtrack pattern fix round 1 review found (60 KB of
 * `[` with no `]` ever closing it), and a name can be attacker-controlled query-string input.
 */
function isSecretParamName(rawName: string): boolean {
  let name = rawName;
  try {
    name = decodeURIComponent(name);
  } catch {
    // Malformed percent-encoding: fall back to testing the raw name as-is.
  }
  const trimmed = name.trimEnd();
  if (SECRET_PARAM_RE.test(trimmed)) return true;
  if (trimmed.endsWith(']')) {
    const open = trimmed.lastIndexOf('[', trimmed.length - 2);
    if (open !== -1 && SECRET_PARAM_RE.test(trimmed.slice(open + 1, trimmed.length - 1))) return true;
  }
  const bracketIdx = trimmed.indexOf('[');
  return bracketIdx !== -1 && SECRET_PARAM_RE.test(trimmed.slice(0, bracketIdx));
}

/**
 * A value like `next=%2Freset-password%3Ftoken%3DX` hides a whole secret-bearing relative URL
 * behind one round of percent-encoding. Decode once (never recursively — `scrubUrlImpl`'s own
 * `allowNestedDecode: false` call below stops it there) and re-run the real scrubber over the
 * decoded form; only replace the original if something actually got masked, so ordinary encoded
 * values (a space as `%20`, a real URL param) are left exactly as they were.
 */
function scrubNestedValue(rawValue: string): string {
  if (!NESTED_ENCODING_HINT_RE.test(rawValue)) return rawValue;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
  const scrubbed = scrubUrlImpl(decoded, false);
  return scrubbed === decoded ? rawValue : scrubbed;
}

/** `match` is a whole `?a=1&b=2` query string (leading `?`, no fragment). */
function scrubQueryString(match: string): string {
  if (match.length <= 1) return match;
  if (PRESIGNED_QUERY_RE.test(match)) return `?${FILTERED}`;
  const params = match
    .slice(1)
    .split('&')
    .map((part) => {
      if (!part) return part;
      const eq = part.indexOf('=');
      const name = eq === -1 ? part : part.slice(0, eq);
      if (!isSecretParamName(name)) return part;
      return eq === -1 ? name : `${name}=${FILTERED}`;
    });
  return `?${params.join('&')}`;
}

/** The blunt backstop pass: masks any secret-named param, decodes+re-scrubs a nested one. */
function scrubAnyParams(text: string): string {
  // A fresh RegExp per call, not the shared module-level ANY_PARAM_RE: this function recurses
  // (see the non-secret + literal-nested-`?` branch below), and a `g`-flag regex carries its scan
  // position in mutable `lastIndex` state — reusing the same object across an outer call and an
  // inner recursive call corrupts the outer call's iteration. A freshly constructed instance has
  // its own `lastIndex`, so nested calls can never interfere with each other.
  return text.replace(new RegExp(ANY_PARAM_RE.source, ANY_PARAM_RE.flags), (whole: string, sep: string, rawName: string, rawValue: string) => {
    if (isSecretParamName(rawName)) return `${sep}${rawName}=${FILTERED}`;
    const qIdx = rawValue.indexOf('?');
    if (qIdx === -1) {
      const scrubbedValue = scrubNestedValue(rawValue);
      return scrubbedValue === rawValue ? whole : `${sep}${rawName}=${scrubbedValue}`;
    }
    // A literal nested query starts here (round 1's own test: `?next=/x?token=Y`). Keep this
    // (non-secret) param's own value to just before it, and let the rest be re-scanned on its
    // own so the nested param is found and masked independently, not swallowed into this value.
    const before = rawValue.slice(0, qIdx);
    const after = rawValue.slice(qIdx);
    return `${sep}${rawName}=${scrubNestedValue(before)}${scrubAnyParams(after)}`;
  });
}

function scrubUrlImpl(url: string, allowNestedDecode: boolean): string {
  const [capped, wasTruncated] = capLength(url);
  const scrubbed = scrubSecrets(capped)
    .replace(FRAGMENT_RE, '')
    .replace(QUERY_RE, scrubQueryString)
    .replace(TOKEN_PATH_RE, (_m, prefix: string) => prefix + FILTERED)
    .replace(LONG_SEGMENT_RE, `/${FILTERED}`);
  const withBackstop = allowNestedDecode ? scrubAnyParams(scrubbed) : scrubbed;
  return wasTruncated ? withBackstop + TRUNCATION_MARKER : withBackstop;
}

export function scrubUrl<T>(url: T): T {
  if (typeof url !== 'string' || !url) return url;
  return scrubUrlImpl(url, true) as T;
}

export function scrubText<T>(text: T): T {
  if (typeof text !== 'string' || !text) return text;
  const [capped, wasTruncated] = capLength(text);
  const scrubbed = scrubAnyParams(
    scrubSecrets(capped)
      .replace(URL_IN_TEXT_RE, (u) => scrubUrl(u))
      .replace(TOKEN_PATH_RE, (_m, prefix: string) => prefix + FILTERED)
      .replace(LONG_SEGMENT_RE, `/${FILTERED}`),
  );
  return (wasTruncated ? scrubbed + TRUNCATION_MARKER : scrubbed) as T;
}

// Browser noise that is never our bug, or is already handled:
// - ResizeObserver: a benign spec warning some browsers surface as an error.
// - Chunk loads after a deploy: src/services/pwa.ts reloads the tab onto the new build. When
//   its once-per-30-s guard (or the OIDC callback route) skips the reload, src/lib/lazyRoute.ts
//   throws this ChunkLoadError instead of letting React.lazy crash on an undefined module.
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
    // console.* arguments can be whole, structured API response objects, which scrubText can't
    // safely clean (it only handles strings). crumb.message above already carries the log line
    // itself, unmasked, so dropping the raw arguments here is a scrubbing-coverage gap, not a
    // names/emails policy.
    delete data.arguments;
  }
}

/**
 * `request.query_string` can be a raw string, a `{name: value}` object, or `[name, value][]`
 * pairs — scrub whichever shape shows up. The string form has no leading `?`; reusing `scrubUrl`
 * on a synthetic `?`-prefixed copy gets the exact same secret-param/presigned-URL handling
 * `scrubQueryString` already gives a URL's own query, without duplicating that logic.
 */
function scrubQueryParams(qp: QueryParams): QueryParams {
  if (typeof qp === 'string') return scrubUrl(`?${qp}`).slice(1);
  if (Array.isArray(qp)) {
    return qp.map(([name, value]): [string, string] => [name, isSecretParamName(name) ? FILTERED : scrubText(value)]);
  }
  return Object.fromEntries(Object.entries(qp).map(([name, value]) => [name, isSecretParamName(name) ? FILTERED : scrubText(value)]));
}

/**
 * Scrubs `request.url`/`headers` (and, when asked, `query_string`) the same way for every event
 * type that carries a `request`: errors keep dropping `query_string`/`cookies`/`data`/`env`
 * outright (unchanged from before this function existed — `keepQueryString: false` reproduces
 * that exactly); transactions keep `query_string`, scrubbed, per WS9 Addendum B.
 */
function scrubRequestInPlace(request: RequestEventData | undefined, keepQueryString: boolean): RequestEventData | undefined {
  if (!request) return request;
  const { url, headers, query_string } = request;
  const scrubbed: RequestEventData = {
    url: url ? scrubUrl(url) : url,
    headers: headers
      ? Object.fromEntries(
          Object.entries(headers)
            .filter(([k]) => ['user-agent', 'referer'].includes(k.toLowerCase()))
            .map(([k, v]) => [k, k.toLowerCase() === 'referer' ? scrubUrl(v) : v]),
        )
      : undefined,
  };
  if (keepQueryString && query_string !== undefined) scrubbed.query_string = scrubQueryParams(query_string);
  return scrubbed;
}

/**
 * Scrubs every string value in a span's `data`/attributes bag (or `contexts.trace.data`, same
 * shape) in place — `url`, `http.url`, `http.query`, `http.fragment`, or any other string
 * attribute a future integration adds. `db.statement` is the one deliberate exception: SQL
 * breadcrumbs keep their query text everywhere else in this policy, and a span carrying one
 * should too.
 */
function scrubDataValuesInPlace(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  for (const key of Object.keys(data)) {
    if (key === 'db.statement') continue;
    const value = data[key];
    if (typeof value === 'string') data[key] = scrubText(value);
  }
}

/** Shared by `beforeSendTransaction`'s `spans[]` loop and the standalone `beforeSendSpan`. */
function scrubSpanInPlace(span: { description?: string; data?: Record<string, unknown> }): void {
  if (span.description) span.description = scrubText(span.description);
  scrubDataValuesInPlace(span.data);
}

export function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isIgnoredEvent(event, hint)) return null;
  event.request = scrubRequestInPlace(event.request, false);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.message) event.message = scrubText(event.message);
  for (const value of exceptionValues(event)) {
    if (value.value) value.value = scrubText(value.value);
  }
  for (const crumb of event.breadcrumbs ?? []) scrubBreadcrumbInPlace(crumb);
  // Allowlist exactly the fields `setSentryUser`/`buildSentryUser` put there — drops anything
  // an unexpected integration might add later, rather than trusting the event as handed to us.
  if (event.user) {
    const { id, email, username, ip_address } = event.user;
    event.user = id != null ? { id, email, username, ip_address } : undefined;
  }
  return event;
}

/**
 * WS9 Addendum B: tracing is off (no `tracesSampleRate`/`tracesSampler` — see
 * `buildSentryInitOptions`), so nothing calls this today. Registering it now, scrubbing exactly
 * like `beforeSend` does, means turning tracing on later doesn't also silently turn on a new,
 * unscrubbed data path — SAT's incident (46k pageload/navigation spans holding SSO codes and
 * handoff tokens verbatim) was exactly that gap, discovered only after tracing had already
 * shipped.
 */
export function beforeSendTransaction(event: TransactionEvent, _hint: EventHint): TransactionEvent | null {
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  event.request = scrubRequestInPlace(event.request, true);
  scrubDataValuesInPlace(event.contexts?.trace?.data);
  for (const span of event.spans ?? []) scrubSpanInPlace(span);
  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === 'string') event.tags[key] = scrubText(value);
    }
  }
  return event;
}

/** Same reasoning as `beforeSendTransaction`: inert today, ready for span streaming later. */
export function beforeSendSpan(span: SpanJSON): SpanJSON {
  scrubSpanInPlace(span);
  return span;
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

export type SentryUserInput = { id: number | string; email?: string | null; name?: string | null; role?: string | null } | null;

/**
 * Builds the object passed to the SDK's `setUser`. Pure and jsdom-free so it can be unit
 * tested directly: `setUser(null)` on logout is exercised by asserting `buildSentryUser(null)`
 * is `null`. `ip_address: "{{auto}}"` asks Sentry's server side to fill in the real client IP;
 * the browser SDK never resolves it itself.
 */
export function buildSentryUser(user: SentryUserInput): { id: string; email?: string; username?: string; ip_address: string } | null {
  if (!user) return null;
  return {
    id: String(user.id),
    email: user.email ?? undefined,
    // `||`, not `??`: an empty-string name (falsy but not null/undefined) must also omit the
    // field rather than send `username: ""`.
    username: user.name || undefined,
    ip_address: '{{auto}}',
  };
}

let currentUser: SentryUserInput = null;

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
  s.setUser(buildSentryUser(currentUser));
  s.setTag('role', currentUser?.role ?? undefined);
}

/**
 * Exported so a test can assert directly on the object handed to `Sentry.init` — not just grep
 * the source — that `tracesSampleRate`/`tracesSampler` are absent (WS9 Addendum B guard: either
 * one turns tracing on; `beforeSendTransaction`/`beforeSendSpan` alone do not, confirmed against
 * `hasSpansEnabled`'s own source in `@sentry/core`, which checks only those two options).
 */
export function buildSentryInitOptions(): Parameters<SentrySdk['init']>[0] {
  return {
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE && RELEASE !== 'unknown' ? RELEASE : undefined,
    dataCollection: {
      // Lets Relay resolve the real client IP for events that carry `ip_address: "{{auto}}"`
      // (see `buildSentryUser`). Everything else here still opts out of the SDK's own
      // automatic collection — request/breadcrumb scrubbing in this file is what we rely on.
      userInfo: true,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      // The query string stays (minus secret params, which `scrubUrl` masks itself).
      urlQueryParams: true,
    },
    // No tracesSampleRate/tracesSampler: errors only. beforeSendTransaction/beforeSendSpan below
    // are registered anyway, scrubbing the same way, so turning tracing on later is safe by
    // default rather than something that has to remember to add scrubbing at the same time.
    maxBreadcrumbs: 50,
    ignoreErrors: IGNORED_MESSAGES,
    denyUrls: [EXTENSION_URL_RE],
    beforeSend,
    beforeBreadcrumb,
    beforeSendTransaction,
    beforeSendSpan,
  };
}

function init(s: SentrySdk) {
  s.init(buildSentryInitOptions());
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

/**
 * Who is signed in. Call after login and after the session-restore `/auth/me`, and with `null`
 * on logout — `applyUser` then calls the SDK's `setUser(null)` to clear it.
 */
export function setSentryUser(user: SentryUserInput): void {
  currentUser = user;
  if (sdk) applyUser(sdk);
}
