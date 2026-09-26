import { describe, expect, it } from 'vitest';
import { resolveLazyModule } from './lazyRoute';

// `React.lazy`'s own promise handling can't be observed from a unit test (no jsdom/Suspense
// runtime in this repo's vitest — see vitest.config.ts), so these exercise `resolveLazyModule`
// directly: it's the actual pass/fail decision behind `lazyRoute`, with `reloadUnderway`
// standing in for pwa.ts's real flag.

function Comp() {
  return null;
}

describe('resolveLazyModule', () => {
  it('passes a normal module straight through', async () => {
    const result = await resolveLazyModule(Promise.resolve({ default: Comp }), () => false);
    expect(result.default).toBe(Comp);
  });

  it('never settles on an undefined module while a reload is underway', async () => {
    const settled = { yes: false };
    resolveLazyModule(Promise.resolve(undefined as never), () => true).then(
      () => { settled.yes = true; },
      () => { settled.yes = true; },
    );
    // Give the microtask queue a turn; a never-settling promise must still be pending after it.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled.yes).toBe(false);
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

  it('never settles on a rejected import while a reload is underway', async () => {
    const settled = { yes: false };
    resolveLazyModule(Promise.reject(new Error('network')), () => true).then(
      () => { settled.yes = true; },
      () => { settled.yes = true; },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(settled.yes).toBe(false);
  });

  it('defaults to the real pwa.ts reload flag when none is passed', async () => {
    // No reload is underway in a fresh test process, so a broken module still surfaces as a
    // ChunkLoadError rather than hanging forever.
    await expect(resolveLazyModule(Promise.resolve(undefined as never))).rejects.toMatchObject({
      name: 'ChunkLoadError',
    });
  });
});
