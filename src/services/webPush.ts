/**
 * Lesson reminders as real push notifications (owner, 2026-10-07: PWA notifications must work).
 *
 * The rules:
 *  - permission is asked ONLY from a tap («Turn on»), never on load: `enablePush()` must be the
 *    first thing a click handler awaits, because Safari shows the dialog only inside the tap;
 *  - an iPhone can receive web push only from the installed app (iOS 16.4+), so a Safari tab
 *    reports `needs-install` and the UI explains installing instead of offering a dead switch;
 *  - the server may not have push set up yet (no VAPID key): then it's `unsupported`, and no
 *    switch is shown at all.
 *
 * Settings and the dashboard read `usePushStatus()`; both call `enablePush()`/`disablePush()`.
 * `createWebPush(deps)` is the testable core; the default instance below wires the browser.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { isIosUserAgent } from '../lib/pwaPlatform';
import { getPwaInstallSnapshot, trackPwa } from './pwaInstall';
import { deleteWebPushSubscription, getWebPushPublicKey, saveWebPushSubscription, type WebPushSubscriptionJson } from './api/webPush';

export type PushStatus = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

export interface PushFacts {
  /** Service worker, PushManager and Notification all exist here. */
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: NotificationPermission | 'unsupported';
}

/** The decision itself. `serverKey` null = the server can't send pushes. */
export function derivePushStatus(facts: PushFacts, serverKey: string | null, subscribed: boolean): PushStatus {
  if (!serverKey) return 'unsupported';
  if (facts.ios && !facts.standalone) return 'needs-install';
  if (!facts.supported || facts.permission === 'unsupported') return 'unsupported';
  if (facts.permission === 'denied') return 'denied';
  if (facts.permission === 'granted' && subscribed) return 'granted';
  return 'default';
}

/** VAPID keys travel as base64url; PushManager wants the raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return true; // unknown: keep the subscription rather than churn it
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** The slice of PushSubscription this module uses (a plain object in tests). */
export interface SubscriptionLike {
  endpoint: string;
  options?: { applicationServerKey?: ArrayBuffer | null };
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

export interface PushManagerLike {
  getSubscription(): Promise<SubscriptionLike | null>;
  subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<SubscriptionLike>;
}

export interface PushDeps {
  facts(): PushFacts;
  /** The service worker's PushManager, or null when no worker is registered (dev server). */
  pushManager(): Promise<PushManagerLike | null>;
  requestPermission(): Promise<NotificationPermission>;
  getKey(): Promise<string | null>;
  save(subscription: WebPushSubscriptionJson): Promise<void>;
  remove(endpoint: string): Promise<void>;
  /** Remembers which user+endpoint the server already has, to skip re-sending it on every load. */
  syncedMarker: { get(): string | null; set(value: string | null): void };
  track(event: string, data?: Record<string, string | number | boolean>): void;
}

function asJson(sub: SubscriptionLike): WebPushSubscriptionJson {
  return sub.toJSON() as WebPushSubscriptionJson;
}

export function createWebPush(deps: PushDeps) {
  let status: PushStatus | null = null;
  let key: string | null | undefined;
  let keyRequest: Promise<string | null> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: PushStatus): PushStatus => {
    if (next !== status) {
      status = next;
      listeners.forEach((l) => l());
    }
    return next;
  };

  const serverKey = (): Promise<string | null> => {
    if (key !== undefined) return Promise.resolve(key);
    keyRequest ??= deps
      .getKey()
      .then((k) => (key = k))
      .catch(() => null) // a network blip: ask again next time, show nothing now
      .finally(() => (keyRequest = null));
    return keyRequest;
  };

  async function refresh(): Promise<PushStatus> {
    const facts = deps.facts();
    const k = await serverKey();
    let subscribed = false;
    if (k && facts.supported && facts.permission === 'granted') {
      const pm = await deps.pushManager().catch(() => null);
      if (!pm) return set('unsupported');
      subscribed = !!(await pm.getSubscription().catch(() => null));
    } else if (k && facts.supported && !facts.ios) {
      // No worker (the dev server): nothing could subscribe, so don't offer it.
      if (!(await deps.pushManager().catch(() => null))) return set('unsupported');
    }
    return set(derivePushStatus(facts, k, subscribed));
  }

  /** Call straight from a click/tap handler (see the module comment). */
  async function enable(): Promise<PushStatus> {
    const facts = deps.facts();
    if (facts.ios && !facts.standalone) return set('needs-install');
    if (!facts.supported) return set('unsupported');
    // Ask before any other await, while the tap still counts as a user gesture.
    const asked = facts.permission === 'granted' ? Promise.resolve<NotificationPermission>('granted') : deps.requestPermission();
    const [permission, k] = await Promise.all([asked, serverKey()]);
    if (permission !== 'granted') {
      deps.track(permission === 'denied' ? 'push_permission_denied' : 'push_permission_ignored');
      return set(permission === 'denied' ? 'denied' : 'default');
    }
    if (!k) return set('unsupported');
    const pm = await deps.pushManager();
    if (!pm) return set('unsupported');
    const appKey = urlBase64ToUint8Array(k);
    let sub = await pm.getSubscription();
    if (sub && !sameBytes(sub.options?.applicationServerKey, appKey)) {
      // The server rotated its key: the old subscription can't receive anything any more.
      await sub.unsubscribe().catch(() => false);
      sub = null;
    }
    sub ??= await pm.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await deps.save(asJson(sub));
    deps.syncedMarker.set(sub.endpoint);
    deps.track('push_enabled');
    return set('granted');
  }

  async function disable(): Promise<PushStatus> {
    const pm = await deps.pushManager().catch(() => null);
    const sub = pm ? await pm.getSubscription() : null;
    if (sub) {
      await deps.remove(sub.endpoint).catch(() => undefined);
      await sub.unsubscribe().catch(() => false);
    }
    deps.syncedMarker.set(null);
    deps.track('push_disabled');
    return refresh();
  }

  /**
   * After sign-in: if this browser is subscribed, make sure the server has it for THIS person
   * (a phone shared by siblings, a subscription the browser rotated). Never asks for permission.
   */
  async function sync(): Promise<void> {
    const facts = deps.facts();
    if (!facts.supported || facts.permission !== 'granted') return;
    const pm = await deps.pushManager().catch(() => null);
    const sub = pm ? await pm.getSubscription().catch(() => null) : null;
    if (!sub || deps.syncedMarker.get() === sub.endpoint) return;
    if (!(await serverKey())) return;
    await deps.save(asJson(sub));
    deps.syncedMarker.set(sub.endpoint);
  }

  /** On sign-out: the server stops pushing to this device for the person leaving. */
  async function detach(): Promise<void> {
    // Nothing was ever sent for this person (most people): no network on sign-out.
    if (!deps.syncedMarker.get()) return;
    const pm = await deps.pushManager().catch(() => null);
    const sub = pm ? await pm.getSubscription().catch(() => null) : null;
    deps.syncedMarker.set(null);
    if (sub) await deps.remove(sub.endpoint);
  }

  return {
    refresh,
    enable,
    disable,
    sync,
    detach,
    current: (): PushStatus | null => status,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Per person: on a shared phone the next person's sign-in must send the subscription again.
const syncedKey = () => `lms_web_push_synced_${getPwaInstallSnapshot().user?.id ?? 'anon'}`;

function browserFacts(): PushFacts {
  const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
  return {
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && hasNotification,
    ios: typeof navigator !== 'undefined' && isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints),
    standalone: getPwaInstallSnapshot().displayMode === 'standalone',
    permission: hasNotification ? Notification.permission : 'unsupported',
  };
}

async function browserPushManager(): Promise<PushManagerLike | null> {
  if (!('serviceWorker' in navigator)) return null;
  // Right after the first load the worker may still be registering (src/services/pwa.ts).
  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => window.setTimeout(() => r(undefined), 4000))]));
  return (registration?.pushManager as unknown as PushManagerLike | undefined) ?? null;
}

const webPush = createWebPush({
  facts: browserFacts,
  pushManager: browserPushManager,
  requestPermission: () => Notification.requestPermission(),
  getKey: getWebPushPublicKey,
  save: saveWebPushSubscription,
  remove: deleteWebPushSubscription,
  syncedMarker: {
    get: () => {
      try {
        return localStorage.getItem(syncedKey());
      } catch {
        return null;
      }
    },
    set: (value) => {
      try {
        if (value) localStorage.setItem(syncedKey(), value);
        else localStorage.removeItem(syncedKey());
      } catch {
        // Blocked storage: the subscription is just re-sent on the next sign-in.
      }
    },
  },
  track: trackPwa,
});

export const refreshPushStatus = webPush.refresh;
export const enablePush = webPush.enable;
export const disablePush = webPush.disable;

/** AuthContext, after sign-in. Best effort, never throws. */
export function syncPushSubscription(): void {
  webPush.sync().catch(() => undefined);
}

/** AuthContext, before sign-out clears the tokens. Waits at most 1.5 s, never throws. */
export async function detachPushOnSignOut(): Promise<void> {
  await Promise.race([webPush.detach().catch(() => undefined), new Promise((r) => window.setTimeout(r, 1500))]);
}

/**
 * The status for Settings and the dashboard; null until the first check finishes. `check` false
 * skips the check (it costs a request for the server's key) where the answer can't be shown.
 */
export function usePushStatus(check = true): PushStatus | null {
  const value = useSyncExternalStore(webPush.subscribe, webPush.current, webPush.current);
  useEffect(() => {
    if (check) webPush.refresh().catch(() => undefined);
  }, [check]);
  return value;
}
