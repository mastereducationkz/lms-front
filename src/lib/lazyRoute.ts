import { lazy } from 'react'
import type { ComponentType } from 'react'
import { clearChunkReloadUnderway, isChunkReloadUnderway } from '../services/pwa'

type LazyModule<T> = { default: T }

// How long to let a Suspense fallback sit on a "reload incoming" chunk failure before giving
// up on it. `window.location.reload()` isn't guaranteed to land promptly — e.g. a
// `beforeunload` confirm the user cancels on unsaved changes — and waiting forever there would
// be worse than the crash this whole helper exists to avoid.
const RELOAD_WAIT_TIMEOUT_MS = 10_000

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
 * reload is in flight there's nothing useful to render, so we wait — Suspense just keeps
 * showing its fallback — but only up to `RELOAD_WAIT_TIMEOUT_MS`: if the reload hasn't landed
 * by then, we give up and throw a `ChunkLoadError` for the nearest ErrorBoundary instead, which
 * shows a "new version, please reload" screen (Sentry already ignores this error name/message
 * — see src/lib/sentry.ts). Same thing immediately, with no wait, when no reload is coming at
 * all.
 *
 * Use this for every lazy-loaded route/component instead of calling `lazy()` directly.
 */
export function lazyRoute<T extends ComponentType<any>>(factory: () => Promise<LazyModule<T>>) {
  return lazy(() => resolveLazyModule(factory()))
}

/**
 * The actual pass/fail decision behind `lazyRoute`, split out so it's testable directly
 * (there's no way to observe `React.lazy`'s internal promise handling from a unit test).
 * `reloadUnderway`/`clearReloadUnderway` default to the real pwa.ts flag and its reset; tests
 * pass stubs instead.
 */
export function resolveLazyModule<T>(
  pending: Promise<LazyModule<T>>,
  reloadUnderway: () => boolean = isChunkReloadUnderway,
  clearReloadUnderway: () => void = clearChunkReloadUnderway,
): Promise<LazyModule<T>> {
  return pending.then(
    (module) => (module && module.default ? module : waitOrFail<T>(reloadUnderway, clearReloadUnderway)),
    () => waitOrFail<T>(reloadUnderway, clearReloadUnderway),
  )
}

function waitOrFail<T>(reloadUnderway: () => boolean, clearReloadUnderway: () => void): Promise<LazyModule<T>> {
  if (reloadUnderway()) {
    // pwa.ts is already reloading the tab onto the fresh build: wait for it, up to the bound.
    // If it hasn't landed by then, treat this as a fresh failure — clear the flag first so a
    // *later* chunk failure in this tab doesn't wait again, it throws right away.
    return new Promise<LazyModule<T>>((_resolve, reject) => {
      setTimeout(() => {
        clearReloadUnderway()
        reject(chunkLoadError())
      }, RELOAD_WAIT_TIMEOUT_MS)
    })
  }
  throw chunkLoadError()
}

function chunkLoadError(): Error {
  const error = new Error('chunk failed to load')
  error.name = 'ChunkLoadError'
  return error
}
