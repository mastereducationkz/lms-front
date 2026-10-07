/**
 * What the service worker does with a web push (public/sw.js imports this; vite bundles it into
 * the worker). Pure, so the payload handling and the click target are unit-tested in node.
 *
 * Payload (lms-backend notification center, src/notifications/channels/web_push.py): JSON
 *   { title, body, url, tag, event }   (icon, badge, data, require_interaction optional)
 * `url` is where a tap goes: an LMS page, or a CRM link for staff. Only this origin and
 * Master Education's own sites are honoured; anything else opens the dashboard instead.
 */
export interface PushPayload {
  title?: unknown;
  body?: unknown;
  url?: unknown;
  tag?: unknown;
  icon?: unknown;
  badge?: unknown;
  data?: unknown;
  require_interaction?: unknown;
}

export const DEFAULT_TITLE = 'Master LMS';
export const DEFAULT_ICON = '/icons/icon-192.png';
// Android draws the badge in the status bar as a white silhouette (scripts/generate-pwa-icons.mjs).
export const DEFAULT_BADGE = '/icons/badge-96.png';
const FALLBACK_PATH = '/dashboard';

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** `event.data.json()`, or its text as the body when it isn't JSON. Never throws. */
export function parsePushData(data: { json(): unknown; text(): string } | null | undefined): PushPayload {
  if (!data) return {};
  try {
    const parsed = data.json();
    if (parsed && typeof parsed === 'object') return parsed as PushPayload;
    return { body: String(parsed ?? '') };
  } catch {
    try {
      return { body: data.text() };
    } catch {
      return {};
    }
  }
}

const TRUSTED_HOST = 'mastereducation.kz';

/** An absolute URL for a tap: on `origin`, or https on a Master Education site; else the dashboard. */
export function safeTargetUrl(url: unknown, origin: string): string {
  const fallback = new URL(FALLBACK_PATH, origin).href;
  if (typeof url !== 'string' || !url.trim()) return fallback;
  try {
    const resolved = new URL(url.trim(), origin);
    if (resolved.origin === origin) return resolved.href;
    const host = resolved.hostname.toLowerCase();
    const ours = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
    return resolved.protocol === 'https:' && ours ? resolved.href : fallback;
  } catch {
    return fallback;
  }
}

/** Same-origin asset path or the default; a push must not pull images from elsewhere. */
function safeAsset(value: unknown, fallback: string, origin: string): string {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    const u = new URL(value, origin);
    return u.origin === origin ? u.pathname + u.search : fallback;
  } catch {
    return fallback;
  }
}

export interface BuiltNotification {
  title: string;
  options: NotificationOptions & { data: { url: string } & Record<string, unknown> };
}

export function buildNotification(payload: PushPayload, origin: string): BuiltNotification {
  const title = str(payload.title, 120) || DEFAULT_TITLE;
  const body = str(payload.body, 400);
  const tag = str(payload.tag, 120);
  const extra = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : {};
  return {
    title,
    options: {
      body,
      icon: safeAsset(payload.icon, DEFAULT_ICON, origin),
      badge: safeAsset(payload.badge, DEFAULT_BADGE, origin),
      // A tag replaces an older notification with the same tag (a reminder that was rescheduled).
      ...(tag ? { tag } : {}),
      requireInteraction: payload.require_interaction === true,
      data: { ...extra, url: safeTargetUrl(payload.url, origin) },
    },
  };
}

export interface ClientLike {
  url: string;
  focused?: boolean;
  visibilityState?: string;
}

/**
 * Which open window a tap should reuse: one already on the target, else the focused/visible one,
 * else any. -1 when there is none (open a new window).
 */
export function pickClientIndex(clients: ReadonlyArray<ClientLike>, target: string): number {
  if (!clients.length) return -1;
  const exact = clients.findIndex((c) => c.url === target);
  if (exact >= 0) return exact;
  const focused = clients.findIndex((c) => c.focused || c.visibilityState === 'visible');
  return focused >= 0 ? focused : 0;
}
