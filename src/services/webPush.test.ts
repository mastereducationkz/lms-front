import { describe, expect, it, vi } from 'vitest';

// webPush.ts wires the browser at import time through these; the core under test is injected.
vi.mock('./api/webPush', () => ({
  getWebPushPublicKey: vi.fn(),
  saveWebPushSubscription: vi.fn(),
  deleteWebPushSubscription: vi.fn(),
}));
vi.mock('./pwaInstall', () => ({
  getPwaInstallSnapshot: () => ({ displayMode: 'browser', user: null }),
  trackPwa: vi.fn(),
}));

import { createWebPush, derivePushStatus, urlBase64ToUint8Array, type PushDeps, type PushFacts, type SubscriptionLike } from './webPush';

// A real-shaped VAPID public key (65 bytes, base64url).
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const OTHER_KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

const facts = (over: Partial<PushFacts> = {}): PushFacts => ({ supported: true, ios: false, standalone: false, permission: 'default', ...over });

type FakeSubscription = SubscriptionLike & { unsubscribed: boolean; unsubscribe: ReturnType<typeof vi.fn> };

function fakeSubscription(endpoint: string, key = KEY): FakeSubscription {
  const sub: FakeSubscription = {
    endpoint,
    unsubscribed: false,
    options: { applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => {
      sub.unsubscribed = true;
      return true;
    }),
  };
  return sub;
}

function setup(over: Omit<Partial<PushDeps>, 'facts'> & { facts?: PushFacts; existing?: SubscriptionLike | null; noWorker?: boolean } = {}) {
  const { facts: initial, existing, noWorker, ...overrides } = over;
  let current = initial ?? facts();
  let sub: FakeSubscription | null = (existing as FakeSubscription | undefined) ?? null;
  let marker: string | null = null;
  const pm = {
    getSubscription: vi.fn(async () => (sub && !sub.unsubscribed ? sub : null)),
    subscribe: vi.fn(async () => (sub = fakeSubscription('https://push.example/new'))),
  };
  const deps: PushDeps = {
    facts: () => current,
    pushManager: async () => (noWorker ? null : pm),
    requestPermission: vi.fn(async () => {
      current = { ...current, permission: 'granted' };
      return 'granted' as NotificationPermission;
    }),
    getKey: vi.fn(async () => KEY),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    syncedMarker: { get: () => marker, set: (v) => (marker = v) },
    track: vi.fn(),
    ...overrides,
  };
  return {
    push: createWebPush(deps),
    deps,
    pm,
    setFacts: (f: Partial<PushFacts>) => (current = { ...current, ...f }),
    marker: () => marker,
  };
}

describe('derivePushStatus', () => {
  it('no server key: unsupported, whatever the browser', () => {
    expect(derivePushStatus(facts({ permission: 'granted' }), null, true)).toBe('unsupported');
    expect(derivePushStatus(facts({ ios: true }), null, false)).toBe('unsupported');
  });
  it('an iPhone Safari tab needs the installed app first', () => {
    expect(derivePushStatus(facts({ ios: true, supported: false }), KEY, false)).toBe('needs-install');
    expect(derivePushStatus(facts({ ios: true, standalone: true }), KEY, false)).toBe('default');
  });
  it('maps the permission, with granted meaning actually subscribed', () => {
    expect(derivePushStatus(facts({ supported: false }), KEY, false)).toBe('unsupported');
    expect(derivePushStatus(facts({ permission: 'denied' }), KEY, false)).toBe('denied');
    expect(derivePushStatus(facts({ permission: 'granted' }), KEY, true)).toBe('granted');
    expect(derivePushStatus(facts({ permission: 'granted' }), KEY, false)).toBe('default');
    expect(derivePushStatus(facts(), KEY, false)).toBe('default');
  });
});

describe('createWebPush', () => {
  it('default → enable → granted: asks, subscribes with the server key, sends it to the server', async () => {
    const { push, deps, pm, marker } = setup();
    expect(await push.refresh()).toBe('default');
    expect(deps.requestPermission).not.toHaveBeenCalled(); // never on load

    expect(await push.enable()).toBe('granted');
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    const [{ applicationServerKey, userVisibleOnly }] = pm.subscribe.mock.calls[0] as unknown as [{ applicationServerKey: Uint8Array; userVisibleOnly: boolean }];
    expect(userVisibleOnly).toBe(true);
    expect(Array.from(applicationServerKey)).toEqual(Array.from(urlBase64ToUint8Array(KEY)));
    expect(deps.save).toHaveBeenCalledWith({ endpoint: 'https://push.example/new', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } });
    expect(marker()).toBe('https://push.example/new');
    expect(push.current()).toBe('granted');
  });

  it('asks for permission before awaiting anything else (Safari needs the tap)', async () => {
    let keyAsked = false;
    const { push, deps } = setup({
      getKey: vi.fn(async () => {
        keyAsked = true;
        return KEY;
      }),
    });
    const pending = push.enable();
    // Synchronously, before the first await settles: permission was requested already.
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    await pending;
    expect(keyAsked).toBe(true);
  });

  it('a refusal → denied, nothing subscribed or saved', async () => {
    const { push, deps, pm } = setup({ requestPermission: vi.fn(async () => 'denied' as NotificationPermission) });
    expect(await push.enable()).toBe('denied');
    expect(pm.subscribe).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('closing the dialog without choosing stays default', async () => {
    const { push } = setup({ requestPermission: vi.fn(async () => 'default' as NotificationPermission) });
    expect(await push.enable()).toBe('default');
  });

  it('iPhone in Safari: needs-install, and enable never prompts', async () => {
    const { push, deps } = setup({ facts: facts({ ios: true, supported: false }) });
    expect(await push.refresh()).toBe('needs-install');
    expect(await push.enable()).toBe('needs-install');
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('a server without a key yet is asked again: push going live reaches open apps (2026-10-07)', async () => {
    const getKey = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(KEY);
    const { push } = setup({ getKey });
    expect(await push.refresh()).toBe('unsupported');
    expect(await push.refresh()).toBe('default');
    expect(getKey).toHaveBeenCalledTimes(2);
    // A real key is kept: no third request.
    await push.refresh();
    expect(getKey).toHaveBeenCalledTimes(2);
  });

  it('server without push, or no service worker (dev): unsupported', async () => {
    expect(await setup({ getKey: vi.fn(async () => null) }).push.refresh()).toBe('unsupported');
    expect(await setup({ noWorker: true }).push.refresh()).toBe('unsupported');
  });

  it('granted and subscribed reads as granted; disable unsubscribes and tells the server', async () => {
    const existing = fakeSubscription('https://push.example/old');
    const { push, deps, marker } = setup({ facts: facts({ permission: 'granted' }), existing });
    expect(await push.refresh()).toBe('granted');
    expect(await push.disable()).toBe('default');
    expect(deps.remove).toHaveBeenCalledWith('https://push.example/old');
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(marker()).toBeNull();
  });

  it('a subscription made with an old server key is replaced', async () => {
    const stale = fakeSubscription('https://push.example/stale', OTHER_KEY);
    const { push, pm } = setup({ facts: facts({ permission: 'granted' }), existing: stale });
    expect(await push.enable()).toBe('granted');
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(pm.subscribe).toHaveBeenCalledTimes(1);
  });

  it('sync after sign-in re-sends an existing subscription once, never prompts', async () => {
    const existing = fakeSubscription('https://push.example/kept');
    const { push, deps } = setup({ facts: facts({ permission: 'granted' }), existing });
    await push.sync();
    await push.sync();
    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('sync does nothing without permission', async () => {
    const { push, deps } = setup();
    await push.sync();
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('detach on sign-out removes the server copy only when one was sent', async () => {
    const existing = fakeSubscription('https://push.example/kept');
    const fresh = setup({ facts: facts({ permission: 'granted' }), existing });
    await fresh.push.detach();
    expect(fresh.deps.remove).not.toHaveBeenCalled(); // nothing synced yet: no network
    await fresh.push.sync();
    await fresh.push.detach();
    expect(fresh.deps.remove).toHaveBeenCalledWith('https://push.example/kept');
    expect(fresh.marker()).toBeNull();
  });

  it('notifies listeners on a change only', async () => {
    const { push } = setup();
    const listener = vi.fn();
    push.subscribe(listener);
    await push.refresh();
    await push.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to its 65 raw bytes', () => {
    const bytes = urlBase64ToUint8Array(KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4); // uncompressed P-256 point
  });
});
