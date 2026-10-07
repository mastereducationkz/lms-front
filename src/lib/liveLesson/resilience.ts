/**
 * A live lesson rides out a short outage (owner Q44, 2026-10-07): a backend deploy drops the API
 * for ~20 s, and a teacher saw the browser's raw "Failed to fetch" in the panel. Here:
 *
 *  - which failures are a blip worth waiting out — no answer at all (the browser's network error;
 *    the proxy's 502/503 page carries no CORS headers, so it arrives as one) or a 502/503/504;
 *  - `withReconnect`, which resends a write with backoff for up to ~25 s, then gives up with a
 *    plain `LiveOffline`. A 4xx is the server's answer and is never retried;
 *  - `liveErrorText`, which never lets a browser's or a transport's own wording reach the screen.
 *
 * A write that isn't safe to send twice (a new question, a pick, +30 s, a word-cloud entry) passes
 * `landed`: before every resend it checks fresh state for the first send having landed after all
 * (the request reached the server, the answer didn't come back), so the last tap still wins once.
 */
import { t } from '../i18n';
import '@/lib/i18n/catalogs/live';

/** How long a write keeps trying before the plain "Couldn't reach the server" (a deploy is ~20 s). */
export const RECONNECT_BUDGET_MS = 25_000;

const BACKOFF_MS = [1_000, 2_000, 3_000, 4_000];
const BACKOFF_CAP_MS = 5_000;

/** Wait before retry number `attempt` (1-based): 1 s, 2 s, 3 s, 4 s, then every 5 s. */
export function backoffDelay(attempt: number): number {
  return BACKOFF_MS[attempt - 1] ?? BACKOFF_CAP_MS;
}

/** The main app's adapter throws this: `status` is the HTTP status, null when the request got no
 *  response at all, undefined when it never was an HTTP failure (a refresh with no token). */
export class LiveRequestError extends Error {
  constructor(message: string, readonly status: number | null | undefined) {
    super(message);
    this.name = 'LiveRequestError';
  }
}

/** A write that still failed after the reconnect window. */
export class LiveOffline extends Error {
  constructor() {
    super(t('live.offline'));
    this.name = 'LiveOffline';
  }
}

const TRANSIENT_STATUS = new Set([502, 503, 504]);
// What browsers and axios say when no response came back: Chrome, Safari, Firefox, axios.
const NO_RESPONSE = /failed to fetch|load failed|networkerror|network error|network request failed/i;

function statusOf(error: unknown): number | null | undefined {
  if (error instanceof LiveRequestError && error.status !== undefined) return error.status;
  const e = error as { status?: unknown; response?: { status?: unknown } } | null;
  if (typeof e?.status === 'number') return e.status;
  if (typeof e?.response?.status === 'number') return e.response.status;
  return undefined;
}

/** A blip worth waiting out: no answer at all, or the proxy saying the backend is away. */
export function isTransient(error: unknown): boolean {
  const status = statusOf(error);
  if (status === null || status === 0) return true;
  if (typeof status === 'number') return TRANSIENT_STATUS.has(status);
  if ((error as { code?: unknown } | null)?.code === 'ERR_NETWORK') return true;
  return error instanceof Error && NO_RESPONSE.test(error.message);
}

// Transport wording that is not the server's answer: never shown as it is.
const RAW_MESSAGE = /^(request failed|network error|failed to fetch|load failed|networkerror|timeout of|the lms is not reachable)/i;

/** What a live screen says about a failed request: the server's own refusal ("Answers are closed")
 *  as it is, a lost connection as "Couldn't reach the server. Try again.", anything else plainly. */
export function liveErrorText(error: unknown): string {
  if (error instanceof LiveOffline || isTransient(error)) return t('live.offline');
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || RAW_MESSAGE.test(message)) return t('live.failed');
  return message;
}

interface ReconnectOptions {
  /** For a write that isn't safe to repeat: true when fresh state shows the first send landed. */
  landed?: () => Promise<boolean>;
  /** Called with true when the write starts waiting out a blip, false when it's over either way. */
  onReconnecting?: (reconnecting: boolean) => void;
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/**
 * Send a write; on a blip, resend with backoff until it goes through or `budgetMs` has passed since
 * the first failure. Resolves with the write's result, or undefined when `landed` found the first
 * send had already gone through. Throws the server's refusal at once, or `LiveOffline`.
 */
export async function withReconnect<T>(write: () => Promise<T>, options: ReconnectOptions = {}): Promise<T | undefined> {
  const { landed, onReconnecting, budgetMs = RECONNECT_BUDGET_MS, sleep = realSleep, now = Date.now } = options;
  let since: number | null = null;
  let attempt = 0;
  try {
    for (;;) {
      try {
        return await write();
      } catch (error) {
        if (!isTransient(error)) throw error;
        if (since === null) {
          since = now();
          onReconnecting?.(true);
        }
      }
      // Wait the blip out; for an unsafe write, first make sure the last send didn't land after all.
      for (;;) {
        attempt += 1;
        const wait = backoffDelay(attempt);
        if (now() - since + wait > budgetMs) throw new LiveOffline();
        await sleep(wait);
        if (!landed) break;
        try {
          if (await landed()) return undefined;
          break;
        } catch (error) {
          if (!isTransient(error)) throw error;
        }
      }
    }
  } finally {
    if (since !== null) onReconnecting?.(false);
  }
}
