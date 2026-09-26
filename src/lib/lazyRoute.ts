import { lazy } from 'react'
import type { ComponentType } from 'react'
import { isChunkReloadUnderway } from '../services/pwa'

type LazyModule<T> = { default: T }

/**
 * Wraps a `React.lazy` factory so a tab left open across a deploy fails safely instead of
 * crashing inside `React.lazy` itself (Sentry LMS-FRONT-1).
 *
 * A deploy removes the previous build's hashed chunks. A tab still on the old bundle then hits
 * one of two failures on its next lazy import:
 *   - the dynamic `import()` rejects (404/network — the chunk is gone), or
 *   - Vite's `__vitePreload` swallows the resulting `vite:preloadError` (when
 *     `src/services/pwa.ts` calls `preventDefault()` on it) and resolves `undefined`, so the
 *     "module" comes back with no `default`.
 * `pwa.ts` reacts to that same event by reloading the tab onto the fresh build — but only when
 * neither of its guards (the 30 s cooldown, the OIDC callback route) skips it. While that
 * reload is in flight there's nothing useful to render, so we return a promise that never
 * settles: Suspense just keeps showing its fallback until the reload lands. Otherwise we throw
 * a `ChunkLoadError` for the nearest ErrorBoundary, which shows a "new version, please reload"
 * screen (Sentry already ignores this error name/message — see src/lib/sentry.ts).
 *
 * Use this for every lazy-loaded route/component instead of calling `lazy()` directly.
 */
export function lazyRoute<T extends ComponentType<any>>(factory: () => Promise<LazyModule<T>>) {
  return lazy(() => resolveLazyModule(factory()))
}

/**
 * The actual pass/fail decision behind `lazyRoute`, split out so it's testable directly
 * (there's no way to observe `React.lazy`'s internal promise handling from a unit test).
 * `reloadUnderway` defaults to the real pwa.ts flag; tests pass a stub instead.
 */
export function resolveLazyModule<T>(
  pending: Promise<LazyModule<T>>,
  reloadUnderway: () => boolean = isChunkReloadUnderway,
): Promise<LazyModule<T>> {
  return pending.then(
    (module) => (module && module.default ? module : waitOrFail<T>(reloadUnderway)),
    () => waitOrFail<T>(reloadUnderway),
  )
}

function waitOrFail<T>(reloadUnderway: () => boolean): Promise<LazyModule<T>> {
  if (reloadUnderway()) {
    // pwa.ts is already reloading the tab onto the fresh build; never resolve, so the
    // Suspense fallback just sits on screen until the reload replaces this whole page.
    return new Promise<LazyModule<T>>(() => {})
  }
  const error = new Error('chunk failed to load')
  error.name = 'ChunkLoadError'
  throw error
}
