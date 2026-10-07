// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/sentry', () => ({ addSentryBreadcrumb: vi.fn(), setSentryTag: vi.fn() }));

import { addSentryBreadcrumb, setSentryTag } from '../lib/sentry';

// Node 25 ships its own half-working global localStorage that shadows jsdom's: use a plain one.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
  };
}
const store = memoryStorage();
vi.stubGlobal('localStorage', store);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DAY = 24 * 60 * 60 * 1000;

// The module keeps one store per page load; each test gets a fresh copy.
async function fresh(userAgent = IPHONE, standalone = false) {
  vi.resetModules();
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  window.matchMedia = ((q: string) => ({
    matches: standalone && q === '(display-mode: standalone)',
    addEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  const mod = await import('./pwaInstall');
  mod.startPwaInstall();
  return mod;
}

describe('pwaInstall (browser glue)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('tags every Sentry event with the display mode', async () => {
    await fresh(IPHONE, true);
    expect(setSentryTag).toHaveBeenCalledWith('display_mode', 'standalone');
  });

  it('iPhone: no card on the first day, the card on the third, kept per user in localStorage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T06:00:00Z'));
    let m = await fresh();
    m.setPwaUser({ id: 7, role: 'student' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);

    vi.setSystemTime(new Date('2026-10-02T06:00:00Z'));
    m = await fresh();
    m.setPwaUser({ id: 7, role: 'student' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);

    vi.setSystemTime(new Date('2026-10-04T06:00:00Z'));
    m = await fresh();
    m.setPwaUser({ id: 7, role: 'student' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(true);
    expect(JSON.parse(localStorage.getItem('lms_pwa_install_v1_7') ?? '{}').days).toEqual(['2026-10-01', '2026-10-02', '2026-10-04']);

    // Someone else on the same phone starts from scratch.
    m.setPwaUser({ id: 8, role: 'student' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);
  });

  it('a homework submission brings it forward to the second day; «Not now» hides it for 14 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T06:00:00Z'));
    let m = await fresh();
    m.setPwaUser({ id: 7 });
    m.notePwaHomeworkSubmitted();
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);

    vi.setSystemTime(new Date('2026-10-02T06:00:00Z'));
    m = await fresh();
    m.setPwaUser({ id: 7 });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(true);
    m.dismissInstallNudge('dashboard');
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);
    expect(addSentryBreadcrumb).toHaveBeenCalledWith('pwa', 'install_prompt_dismissed', expect.objectContaining({ surface: 'dashboard' }));
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot(), Date.now() + 15 * DAY)).toBe(true);
  });

  it('never inside the installed app, and «It’s on my Home Screen» ends it in Safari', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T06:00:00Z'));
    let m = await fresh(IPHONE, true);
    m.setPwaUser({ id: 7, onboardingCompletedAt: '2026-09-01T10:00:00Z' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);
    expect(m.pushNudgeVisible(m.getPwaInstallSnapshot())).toBe(true);

    localStorage.clear();
    m = await fresh();
    m.setPwaUser({ id: 7, onboardingCompletedAt: '2026-09-01T10:00:00Z' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(true);
    m.markInstalledByHand();
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);
  });

  it('Chrome: only with the browser’s install offer in hand; the offer is kept and replayed on tap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T06:00:00Z'));
    const m = await fresh('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36');
    m.setPwaUser({ id: 7, onboardingCompletedAt: '2026-09-01T10:00:00Z' });
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);

    const prompt = vi.fn(async () => undefined);
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(offer);
    expect(offer.defaultPrevented).toBe(true); // no mini-infobar of Chrome's own
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(true);

    expect(await m.promptInstall('dashboard')).toBe('accepted');
    expect(prompt).toHaveBeenCalled();
    expect(m.installNudgeVisible(m.getPwaInstallSnapshot())).toBe(false);
    expect(await m.promptInstall('dashboard')).toBe('unavailable');
  });

  it('survives blocked storage', async () => {
    const m = await fresh();
    const spy = vi.spyOn(store, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const set = vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => m.setPwaUser({ id: 9 })).not.toThrow();
    expect(() => m.dismissInstallNudge('dashboard')).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });
});
