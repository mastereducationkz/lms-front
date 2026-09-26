import { describe, expect, it } from 'vitest';
import { isChunkReloadUnderway, registerPwa, shouldReloadOnPreloadError } from './pwa';

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
