import { afterEach, describe, expect, it, vi } from 'vitest';

// This repo's vitest runs in a plain Node environment (no jsdom/`window` — see
// vitest.config.ts). `openPlatformPage` guards every DOM call behind
// `typeof window !== 'undefined'`, so these tests stub a minimal fake `window` for the
// duration of each test rather than pull in a full DOM.
vi.mock('../services/api/handoff', () => ({ mintHandoff: vi.fn() }));

import { mintHandoff } from '../services/api/handoff';
import { openPlatformPage } from './platformLinks';

const mockMintHandoff = vi.mocked(mintHandoff);
const MINTED_URL = 'https://sat.mastereducation.kz/handoff?token=abc';

/** A fake `window.open` target: settable `opener`, and a `location.href` setter that can be
 *  made to throw (iOS Safari's `SecurityError: The operation is insecure`, LMS-FRONT-2). */
function makeTab({ throwOnLocationSet = false, closed = false } = {}) {
  let href = '';
  const location = {};
  Object.defineProperty(location, 'href', {
    configurable: true,
    get: () => href,
    set: (v: string) => {
      if (throwOnLocationSet) throw new DOMException('The operation is insecure.', 'SecurityError');
      href = v;
    },
  });
  const tab = { location, closed, opener: 'not-null-yet' as unknown, close: vi.fn() };
  return { tab, getHref: () => href };
}

afterEach(() => {
  vi.unstubAllGlobals();
  mockMintHandoff.mockReset();
});

describe('openPlatformPage', () => {
  it('desktop happy path: opens a tab synchronously, then points it at the minted URL', async () => {
    const { tab, getHref } = makeTab();
    const open = vi.fn().mockReturnValue(tab);
    const assign = vi.fn();
    vi.stubGlobal('window', { open, location: { assign } });
    mockMintHandoff.mockResolvedValue({ url: MINTED_URL, expires_in: 60 });

    await openPlatformPage('sat', '/dashboard');

    expect(tab.opener).toBeNull();
    expect(getHref()).toBe(MINTED_URL);
    expect(open).toHaveBeenCalledTimes(1); // only the synchronous about:blank open, no fallback
    expect(assign).not.toHaveBeenCalled();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('iOS Safari: a pre-opened tab whose location setter throws falls back to the current tab', async () => {
    const { tab } = makeTab({ throwOnLocationSet: true });
    // First call (inside the click) returns the tab above; the later fallback attempt (after
    // the await, outside the original gesture) is refused, as commonly happens on mobile.
    const open = vi.fn().mockReturnValueOnce(tab).mockReturnValue(null);
    const assign = vi.fn();
    vi.stubGlobal('window', { open, location: { assign } });
    mockMintHandoff.mockResolvedValue({ url: MINTED_URL, expires_in: 60 });

    await expect(openPlatformPage('sat', '/dashboard')).resolves.toBeUndefined();

    expect(assign).toHaveBeenCalledWith(MINTED_URL);
    expect(tab.close).toHaveBeenCalledTimes(1); // no stray about:blank tab left behind
  });

  it('window.open throwing SecurityError falls back to the current tab', async () => {
    const open = vi.fn(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    const assign = vi.fn();
    vi.stubGlobal('window', { open, location: { assign } });
    mockMintHandoff.mockResolvedValue({ url: MINTED_URL, expires_in: 60 });

    await expect(openPlatformPage('sat', '/dashboard')).resolves.toBeUndefined();

    expect(assign).toHaveBeenCalledWith(MINTED_URL);
  });

  it('a fully blocked popup (window.open always returns null) falls back to the current tab', async () => {
    const open = vi.fn().mockReturnValue(null);
    const assign = vi.fn();
    vi.stubGlobal('window', { open, location: { assign } });
    mockMintHandoff.mockResolvedValue({ url: MINTED_URL, expires_in: 60 });

    await openPlatformPage('sat', '/dashboard');

    expect(assign).toHaveBeenCalledWith(MINTED_URL);
  });
});
