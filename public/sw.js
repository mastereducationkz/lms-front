import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Take over immediately. The previous prompt-based flow left a deployed fix
// installed-but-WAITING until the user closed every tab of the origin — a plain
// reload never activates a waiting worker, so long-lived tabs (teachers keep the
// calendar open for weeks) ran stale bundles indefinitely and "fixed" bugs kept
// reappearing. Old bundles predate any in-page update code, so the ONLY lever
// that reaches them is the service worker script itself: activate on install,
// claim the clients, and let the page-side vite:preloadError handler reload the
// one tab that might lose a lazy chunk mid-session (see src/services/pwa.ts).
self.addEventListener('install', () => {
  self.skipWaiting()
})
clientsClaim()

// Kept for the in-page "Обновить" button; harmless now that install skips waiting.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
