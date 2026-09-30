/**
 * Proving that the LMS sign-in window belongs to the Meet panel that asked (2026-09-30).
 *
 * The panel (an iframe on lms.* inside meet.google.com) opens the sign-in popup itself. It holds
 * a pair secret from `POST /auth/addon-handoff` and hands it to that popup — and only to a window
 * of the LMS origin that asks for this handoff — by `postMessage`. The popup sends it with
 * «Allow», and the backend accepts that as proof instead of "same client IP". A link opened any
 * other way (forwarded in a chat, opened by an attacker's page) has no opener on the LMS origin
 * and never gets the secret.
 *
 * Meet serves `Cross-Origin-Opener-Policy: same-origin-allow-popups`, so the popup keeps its
 * opener. When it does not (an SSO page in between severed it), the popup falls back to the
 * network rule.
 */

export const PAIR_REQUEST = 'lms-meet-addon:pair-request';
export const PAIR_REPLY = 'lms-meet-addon:pair';

interface Listener {
  addEventListener(type: 'message', handler: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', handler: (event: MessageEvent) => void): void;
}

interface Poster {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** Panel side: answer the sign-in window's request with the pair secret. Returns the unsubscribe. */
export function answerPairRequests(
  target: Listener,
  origin: string,
  handoffId: string,
  pairSecret: string,
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    const data = event.data as { type?: unknown; h?: unknown } | null;
    if (!data || data.type !== PAIR_REQUEST || data.h !== handoffId) return;
    const source = event.source as Poster | null;
    try {
      source?.postMessage({ type: PAIR_REPLY, h: handoffId, pair_secret: pairSecret }, origin);
    } catch {
      /* the window went away */
    }
  };
  target.addEventListener('message', handler);
  return () => target.removeEventListener('message', handler);
}

/** Popup side: ask the window that opened this one for the pair secret; null when nobody answers. */
export function requestPairSecret(
  opener: Poster | null | undefined,
  self: Listener,
  origin: string,
  handoffId: string,
  timeoutMs = 1500,
): Promise<string | null> {
  if (!opener) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      self.removeEventListener('message', handler);
      clearTimeout(timer);
      resolve(value);
    };
    const handler = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== opener) return;
      const data = event.data as { type?: unknown; h?: unknown; pair_secret?: unknown } | null;
      if (!data || data.type !== PAIR_REPLY || data.h !== handoffId) return;
      finish(typeof data.pair_secret === 'string' && data.pair_secret ? data.pair_secret : null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    self.addEventListener('message', handler);
    try {
      opener.postMessage({ type: PAIR_REQUEST, h: handoffId }, origin);
    } catch {
      finish(null);
    }
  });
}
