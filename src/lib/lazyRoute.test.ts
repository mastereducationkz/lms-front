import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLazyModule } from './lazyRoute';

// `React.lazy`'s own promise handling can't be observed from a unit test (no jsdom/Suspense
// runtime in this repo's vitest — see vitest.config.ts), so these exercise `resolveLazyModule`
// directly: it's the actual pass/fail decision behind `lazyRoute`, with `reloadUnderway`/
// `clearReloadUnderway` standing in for pwa.ts's real flag and its reset.

function Comp() {
  return null;
}

describe('resolveLazyModule', () => {
  it('passes a normal module straight through', async () => {
    const result = await resolveLazyModule(Promise.resolve({ default: Comp }), () => false);
    expect(result.default).toBe(Comp);
  });

  it('throws a ChunkLoadError for an undefined module once no reload is coming', async () => {
    await expect(resolveLazyModule(Promise.resolve(undefined as never), () => false)).rejects.toMatchObject({
      name: 'ChunkLoadError',
      message: 'chunk failed to load',
    });
  });

  it('throws a ChunkLoadError for a rejected import once no reload is coming', async () => {
    await expect(
      resolveLazyModule(Promise.reject(new Error('Failed to fetch dynamically imported module')), () => false),
    ).rejects.toMatchObject({ name: 'ChunkLoadError' });
  });

  it('defaults to the real pwa.ts reload flag when none is passed', async () => {
    // No reload is underway in a fresh test process, so a broken module still surfaces as a
    // ChunkLoadError rather than hanging forever.
    await expect(resolveLazyModule(Promise.resolve(undefined as never))).rejects.toMatchObject({
      name: 'ChunkLoadError',
    });
  });

  // The reload pwa.ts kicks off isn't guaranteed to land (e.g. a beforeunload confirm the user
  // cancels on unsaved changes), so the wait for it is bounded — see RELOAD_WAIT_TIMEOUT_MS in
  // lazyRoute.ts. These use fake timers to observe both sides of that bound without a real
  // 10 s sleep.
  describe('while a reload is underway', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['an undefined module', () => Promise.resolve(undefined as never)],
      ['a rejected import', () => Promise.reject(new Error('network'))],
    ])('still waits on %s just before the 10s bound', async (_label, pending) => {
      const settled = { yes: false };
      resolveLazyModule(pending(), () => true, () => {}).then(
        () => { settled.yes = true; },
        () => { settled.yes = true; },
      );

      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled.yes).toBe(false);
    });

    it('rejects with a ChunkLoadError once the 10s bound elapses without the reload landing', async () => {
      const pending = resolveLazyModule(Promise.resolve(undefined as never), () => true, () => {});
      const assertion = expect(pending).rejects.toMatchObject({
        name: 'ChunkLoadError',
        message: 'chunk failed to load',
      });
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
    });

    it('clears the reload-underway flag once the bound elapses, so the next failure throws immediately', async () => {
      let underway = true;
      const reloadUnderway = () => underway;
      const clearReloadUnderway = () => { underway = false; };

      const first = resolveLazyModule(Promise.resolve(undefined as never), reloadUnderway, clearReloadUnderway);
      const firstAssertion = expect(first).rejects.toMatchObject({ name: 'ChunkLoadError' });
      await vi.advanceTimersByTimeAsync(10_000);
      await firstAssertion;
      expect(underway).toBe(false);

      // The flag is cleared now: a second failure must throw right away, with no wait at all.
      await expect(
        resolveLazyModule(Promise.resolve(undefined as never), reloadUnderway, clearReloadUnderway),
      ).rejects.toMatchObject({ name: 'ChunkLoadError' });
    });
  });
});
