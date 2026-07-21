import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

// Poll the server for a newer service worker while a tab stays open, so a
// long-lived session doesn't get stuck on a stale precached bundle until the
// user happens to do a full reload.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 min
// Also re-check when the user returns to the tab, throttled so rapid tab
// switches don't hammer the server.
const FOCUS_CHECK_THROTTLE_MS = 5 * 60 * 1000 // 5 min

/**
 * Registers the service worker with an explicit, user-driven update flow.
 *
 * When a new build is deployed, the waiting SW does NOT take over open tabs. Instead we show a
 * persistent toast; only if the user clicks "Обновить" do we call updateSW(true), which posts
 * SKIP_WAITING to the waiting worker and reloads once. This replaces the old auto-skipWaiting +
 * clientsClaim behavior that hijacked live sessions on every deploy.
 *
 * To keep that prompt timely (rather than a session lingering on an old bundle indefinitely), we
 * proactively call registration.update() on an interval and when the tab regains focus — that
 * re-fetches the SW script and, if it changed, triggers onNeedRefresh (the toast). We still never
 * auto-apply: the user stays in control of when the reload happens.
 */
export function registerPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast('Доступна новая версия', {
        description: 'Обновите страницу, чтобы применить последние изменения.',
        duration: Infinity,
        action: {
          label: 'Обновить',
          onClick: () => {
            void updateSW(true)
          },
        },
      })
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return

      // registration.update() re-fetches the SW script; if the deployed bundle
      // changed, the browser installs the new worker and vite-plugin-pwa fires
      // onNeedRefresh (the toast above). Never throws to the caller.
      const checkForUpdate = () => {
        registration.update().catch(() => {})
      }

      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)

      let lastFocusCheck = 0
      const onReturn = () => {
        if (document.visibilityState !== 'visible') return
        const now = Date.now()
        if (now - lastFocusCheck < FOCUS_CHECK_THROTTLE_MS) return
        lastFocusCheck = now
        checkForUpdate()
      }
      document.addEventListener('visibilitychange', onReturn)
      window.addEventListener('focus', onReturn)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error)
    },
  })
}
