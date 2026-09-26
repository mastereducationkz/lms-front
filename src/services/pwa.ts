import { toast } from 'sonner'

// Poll the server for a newer service worker while a tab stays open, so a
// long-lived session doesn't get stuck on a stale precached bundle until the
// user happens to do a full reload.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 min
// Also re-check when the user returns to the tab, throttled so rapid tab
// switches don't hammer the server.
const FOCUS_CHECK_THROTTLE_MS = 5 * 60 * 1000 // 5 min

// Once a new build is detected we don't force a reload onto the screen the user
// is actively looking at (that could hijack e.g. a teacher mid-lesson). Instead
// we remember that an update is waiting and apply it at the next SAFE moment:
//   - the user backgrounds/hides the tab (reload happens while they're away), or
//   - the user navigates to another page (see applyPendingPwaUpdate, called by
//     the router on route change).
// The "Обновить" toast still lets an active user apply it immediately. In every
// case the reload goes through beforeunload, so useUnsavedChangesWarning still
// guards any in-progress homework.
let updatePending = false
let applying = false

const OIDC_CALLBACK_PATH = '/auth/callback'
const CHUNK_RELOAD_GUARD_KEY = 'pwa-chunk-reload'

/**
 * The one route a reload must never touch. /auth/callback carries a single-use
 * authorization code + PKCE state: reloading it replays a URL whose credentials are
 * already spent, and the login dies with "no matching state". A student switching apps
 * mid-login (they arrive from Telegram) is enough to trigger it. The update just waits
 * for the next safe moment — landing on the dashboard is one.
 */
function onOidcCallback(): boolean {
  return window.location.pathname === OIDC_CALLBACK_PATH
}

/**
 * Pure decision for the `vite:preloadError` handler below, split out so it's testable without
 * `window`/`sessionStorage` (this repo's vitest runs with no jsdom). Mirrors the same two
 * reload guards as `applyUpdate()`: never the OIDC callback, and never more than once per
 * cooldown window (a real deploy can drop several chunks at once).
 */
export function shouldReloadOnPreloadError(pathname: string, guardAlreadyFired: boolean): boolean {
  if (pathname === OIDC_CALLBACK_PATH) return false
  return !guardAlreadyFired
}

// How long the guard below blocks a repeat reload for.
const CHUNK_RELOAD_GUARD_WINDOW_MS = 30_000
// Tolerance for a stored timestamp slightly ahead of `now` (clock adjustments, timer jitter)
// before it's treated as corrupt/foreign data rather than "just fired".
const CHUNK_RELOAD_GUARD_CLOCK_SKEW_MS = 5_000

/**
 * Whether the once-per-30s reload guard has already fired recently. `stored` is whatever is in
 * sessionStorage under `CHUNK_RELOAD_GUARD_KEY`.
 *
 * This has to be a timestamp, not a sticky flag: the `window.setTimeout` that used to clear it
 * lived in the page that was about to be replaced by the reload it guarded, so it was killed
 * before it ever fired — the guard silently lasted for the rest of the tab's session, and a
 * second deploy in the same tab never auto-reloaded again. Storing `Date.now()` and checking
 * elapsed time on the next read needs no timer to survive the reload.
 *
 * A missing key, unparseable garbage, the old sticky `"1"` value (reads as an ancient
 * timestamp — always long expired), or a timestamp too far in the future (clock skew beyond
 * `CHUNK_RELOAD_GUARD_CLOCK_SKEW_MS`, i.e. not something this tab wrote) all count as "not
 * fired": a stale or malformed value must never block a reload forever.
 */
export function chunkReloadGuardFired(stored: string | null, now: number): boolean {
  if (stored === null) return false
  const firedAt = Number(stored)
  if (!Number.isFinite(firedAt)) return false
  if (firedAt - now > CHUNK_RELOAD_GUARD_CLOCK_SKEW_MS) return false
  return now - firedAt < CHUNK_RELOAD_GUARD_WINDOW_MS
}

// Set while a `vite:preloadError` reload is in flight (see below). `src/lib/lazyRoute.ts`
// checks this to decide whether a broken lazy import should just wait for the reload to land
// (bounded — see lazyRoute.ts) instead of throwing a ChunkLoadError at the ErrorBoundary right
// away.
let chunkReloadUnderway = false

/** Whether a chunk-load reload is currently in flight. Exported for `lazyRoute`. */
export function isChunkReloadUnderway(): boolean {
  return chunkReloadUnderway
}

/**
 * Called by `lazyRoute` when its bounded wait times out without the reload having landed
 * (e.g. a `beforeunload` confirm the user cancelled on unsaved changes). Without this, every
 * later lazy-chunk failure in the same tab would also wait, forever, instead of surfacing the
 * ErrorBoundary's reload screen.
 */
export function clearChunkReloadUnderway(): void {
  chunkReloadUnderway = false
}

function applyUpdate(): void {
  if (!updatePending || applying) return
  if (onOidcCallback()) return
  applying = true
  // The worker already took over (skipWaiting+claim in sw.js); a plain reload
  // is what swaps the running bundle.
  window.location.reload()
}

/**
 * Called by the router on every route change. If a new build is waiting, this is
 * a safe moment to swap it in: the current page's state is being torn down anyway
 * and any unsaved-changes guard has already run for the navigation.
 */
export function applyPendingPwaUpdate(): void {
  applyUpdate()
}

/**
 * Registers the service worker. New builds are detected proactively
 * (registration.update() on an interval + on tab focus) and then applied at the
 * next safe moment (tab hidden / navigation), with a toast for immediate opt-in.
 */
export function registerPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  // A deploy removes the previous build's hashed chunks, so a tab that was open
  // across a deploy can fail a lazy import. Reload once to land on the fresh
  // bundle instead of showing a broken page; the guard prevents a reload loop.
  // Vite's `__vitePreload` swallows the failed import and resolves `undefined` whenever
  // `preventDefault()` is called — so it's only safe to call when we're actually about to
  // reload. When a guard skips the reload, we leave the event alone and let the rejection
  // propagate to the failed dynamic import(), which `lazyRoute` turns into a ChunkLoadError.
  window.addEventListener('vite:preloadError', (event) => {
    const guardAlreadyFired = chunkReloadGuardFired(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY), Date.now())
    if (!shouldReloadOnPreloadError(window.location.pathname, guardAlreadyFired)) return
    event.preventDefault()
    chunkReloadUnderway = true
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
    window.location.reload()
  })

  // New worker took control (skipWaiting+claim): the fresh bundle is one reload
  // away. Reuse the safe-moment machinery (tab hidden / route change / toast).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!navigator.serviceWorker.controller) return
    updatePending = true
  })

  // Dynamically imported (rather than a static top-level import) so this module — and the
  // pure helpers/flag above that lazyRoute.ts depends on — stay importable outside a Vite
  // build: `virtual:pwa-register` only exists as a module the VitePWA plugin injects, and
  // this repo's vitest config deliberately doesn't load that plugin (see vitest.config.ts).
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        updatePending = true
        toast('Доступна новая версия', {
          description: 'Обновление применится автоматически. Нажмите, чтобы применить сейчас.',
          duration: Infinity,
          action: {
            label: 'Обновить',
            onClick: () => {
              applyUpdate()
            },
          },
        })
      },
      onRegisteredSW(_swScriptUrl, registration) {
        if (!registration) return

        // registration.update() re-fetches the SW script; if the deployed bundle
        // changed, the browser installs the new worker and vite-plugin-pwa fires
        // onNeedRefresh (setting updatePending). Never throws to the caller.
        const checkForUpdate = () => {
          registration.update().catch(() => {})
        }

        window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)

        let lastFocusCheck = 0
        const onVisibility = () => {
          if (document.visibilityState === 'hidden') {
            // Tab going to the background is the smoothest moment to swap bundles:
            // the reload happens off-screen and the user returns on the fresh build.
            applyUpdate()
            return
          }
          // Became visible again: re-check for a newer build (throttled).
          const now = Date.now()
          if (now - lastFocusCheck < FOCUS_CHECK_THROTTLE_MS) return
          lastFocusCheck = now
          checkForUpdate()
        }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('focus', onVisibility)
      },
      onRegisterError(error) {
        console.error('Service worker registration failed:', error)
      },
    })
  })
}
