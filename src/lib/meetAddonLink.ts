/**
 * The Meet add-on's sign-in popup (`/meet-addon/link?h=<handoff>`, owner 2026-09-28): a teacher
 * approves, from their normal LMS session, the Meet side panel that asked for one. The rules the
 * page follows live here so they are tested; the page only draws them.
 */

/** Roles the backend lets connect the panel (lms-backend `addon_handoff.ADDON_ROLES`). */
export const PANEL_ROLES = ['teacher', 'head_teacher', 'admin'] as const;

export function mayUsePanel(role: string | null | undefined): boolean {
  return (PANEL_ROLES as readonly string[]).includes((role ?? '').trim().toLowerCase());
}

export interface HandoffInfo {
  status: 'pending' | 'approved' | 'denied';
  meeting_code: string | null;
  expires_in: number;
  same_network: boolean;
}

export type LinkState =
  | { kind: 'loading' }
  | { kind: 'ask'; info: HandoffInfo }
  | { kind: 'other_network'; info: HandoffInfo }
  | { kind: 'answered' }
  | { kind: 'expired' }
  | { kind: 'staff_only' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; approved: boolean };

const HANDOFF_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function handoffIdFrom(search: string): string | null {
  const id = new URLSearchParams(search).get('h');
  return id && HANDOFF_ID.test(id) ? id : null;
}

/** What the page shows for the handoff it was opened for. `paired` = the Meet panel that asked
 *  handed this window its pair secret (`lib/addonPairing`), which proves it is the panel's own
 *  window whatever network each of them reached the LMS from. */
export function stateFromInfo(info: HandoffInfo, paired = false): LinkState {
  if (info.status !== 'pending') return { kind: 'answered' };
  if (!info.same_network && !paired) return { kind: 'other_network', info };
  return { kind: 'ask', info };
}

/** What the page shows when reading the handoff, or answering it, failed. */
export function stateFromError(status: number | null, detail: string | null): LinkState {
  if (status === 404) return { kind: 'expired' };
  if (status === 409) return { kind: 'answered' };
  if (status === 403 && detail && /different network/i.test(detail)) return { kind: 'error', message: detail };
  if (status === 403) return { kind: 'staff_only' };
  if (status === 503) return { kind: 'error', message: 'Sign-in is unavailable right now. Try again in a minute.' };
  return { kind: 'error', message: detail || 'Something went wrong. Try again.' };
}

// --- carrying the link across an SSO login --------------------------------------------------
//
// A signed-out teacher is sent to /login first. A password login comes back through the router's
// `state.from`, but the SSO round trip always lands on /dashboard, which would lose the handoff.
// The page remembers its own address in sessionStorage (this popup only) and the SSO callback
// takes it back. Only this page's shape is ever returned, so nothing else can steer the callback.

export const POST_LOGIN_KEY = 'lms.meet-addon.post-login';
const POST_LOGIN_TTL_MS = 10 * 60 * 1000;
const LINK_PATH = /^\/meet-addon\/link\?h=[A-Za-z0-9_-]{16,64}$/;

interface SessionStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function session(): SessionStore | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function rememberLinkForLogin(path: string, store: SessionStore | null = session(), now = Date.now()): void {
  if (!LINK_PATH.test(path)) return;
  try {
    store?.setItem(POST_LOGIN_KEY, JSON.stringify({ path, at: now }));
  } catch {
    /* the teacher reopens the link from Meet */
  }
}

export function takeLinkAfterLogin(store: SessionStore | null = session(), now = Date.now()): string | null {
  try {
    const raw = store?.getItem(POST_LOGIN_KEY);
    store?.removeItem(POST_LOGIN_KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== 'string' || !LINK_PATH.test(path)) return null;
    if (typeof at !== 'number' || now - at > POST_LOGIN_TTL_MS) return null;
    return path;
  } catch {
    return null;
  }
}
