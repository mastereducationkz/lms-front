import { describe, expect, it, vi } from 'vitest';
import { chunkReloadGuardFired, isChunkReloadUnderway, pickRegisterSW, registerPwa, shouldReloadOnPreloadError, updateToastCopy } from './pwa';

// This repo's vitest runs in a plain Node environment (no jsdom, no `window`/`sessionStorage`
// — see vitest.config.ts), so the `vite:preloadError` listener itself can't be dispatched
// here. `shouldReloadOnPreloadError` is the decision it makes before calling
// `event.preventDefault()`, pulled out as a pure function precisely so it's testable without
// touching the DOM: preventDefault (and the reload) must only happen when this returns true.
describe('shouldReloadOnPreloadError', () => {
  it('reloads on an ordinary route with no guard fired yet', () => {
    expect(shouldReloadOnPreloadError('/dashboard', false)).toBe(true);
  });

  it('never reloads the OIDC callback route, guard or not', () => {
    expect(shouldReloadOnPreloadError('/auth/callback', false)).toBe(false);
    expect(shouldReloadOnPreloadError('/auth/callback', true)).toBe(false);
  });

  it('skips the reload once the once-per-30s guard has already fired', () => {
    expect(shouldReloadOnPreloadError('/dashboard', true)).toBe(false);
  });
});

describe('chunkReloadGuardFired', () => {
  const NOW = 1_700_000_000_000;

  it('is not fired when the key was never set', () => {
    expect(chunkReloadGuardFired(null, NOW)).toBe(false);
  });

  it('is not fired for the old sticky "1" value (reads as an ancient, expired timestamp)', () => {
    expect(chunkReloadGuardFired('1', NOW)).toBe(false);
  });

  it('is not fired for unparseable garbage', () => {
    expect(chunkReloadGuardFired('not-a-number', NOW)).toBe(false);
  });

  it('is fired for a timestamp written just now', () => {
    expect(chunkReloadGuardFired(String(NOW - 100), NOW)).toBe(true);
  });

  it('is not fired once the 30s window has elapsed', () => {
    expect(chunkReloadGuardFired(String(NOW - 31_000), NOW)).toBe(false);
  });

  it('is not fired for a timestamp far in the future (foreign/corrupt data, not clock skew)', () => {
    expect(chunkReloadGuardFired(String(NOW + 60_000), NOW)).toBe(false);
  });
});

describe('isChunkReloadUnderway', () => {
  it('is false until a preload-error reload actually starts', () => {
    // Nothing in this process has triggered a reload, so lazyRoute must see this as false
    // and surface real chunk failures as a ChunkLoadError instead of hanging forever.
    expect(isChunkReloadUnderway()).toBe(false);
  });
});

describe('registerPwa', () => {
  it('is a no-op outside a browser (no window/serviceWorker), so it is safe to import and call here', () => {
    expect(() => registerPwa()).not.toThrow();
  });
});

describe('pickRegisterSW (LMS-FRONT-4)', () => {
  it('is null when the import resolved to undefined (a deleted chunk right after a deploy)', () => {
    expect(pickRegisterSW(undefined)).toBeNull();
    expect(pickRegisterSW(null)).toBeNull();
  });

  it('is null when the module has no callable registerSW', () => {
    expect(pickRegisterSW({})).toBeNull();
    expect(pickRegisterSW({ registerSW: 'nope' as unknown as () => void })).toBeNull();
  });

  it('returns the real registerSW untouched', () => {
    const registerSW = vi.fn();
    expect(pickRegisterSW({ registerSW })).toBe(registerSW);
  });
});

describe('updateToastCopy', () => {
  it('English for students and teachers, Russian for curators', () => {
    expect(updateToastCopy('en')).toEqual({
      title: 'A new version is ready',
      description: 'It switches in by itself when you open another page. Or update now.',
      action: 'Update',
    });
    expect(updateToastCopy('ru').action).toBe('Обновить');
  });
});
