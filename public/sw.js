import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'
import { buildNotification, parsePushData, pickClientIndex } from '../src/lib/pushNotification'

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

// Kept for the in-page "Update" button; harmless now that install skips waiting.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Offline fallback for page loads. Registered after the precache route, so "/" still comes
// from the precache exactly as before; every other navigation goes to the network as before,
// and only when that FAILS (no connection) does the branded offline page answer instead of
// the browser's error screen. /auth/callback is left alone: its one-time code must reach the
// network or fail plainly.
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request)
      } catch (error) {
        const offline = await matchPrecache('/offline.html')
        if (offline) return offline
        throw error
      }
    },
    { denylist: [/^\/auth\/callback/, /^\/meet-addon/] },
  ),
)

// Web push (notification center, lms-backend). The page subscribes only after the person
// tapped "Turn on" (src/services/webPush.ts); this shows what the server sends.
self.addEventListener('push', (event) => {
  const { title, options } = buildNotification(parsePushData(event.data), self.location.origin)
  event.waitUntil(self.registration.showNotification(title, options))
})

// A tap focuses a window already showing that page, else brings an open LMS window to it,
// else opens one. A CRM link (staff) always opens on its own, leaving the LMS window as it was.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || new URL('/dashboard', self.location.origin).href
  event.waitUntil(
    (async () => {
      if (new URL(target).origin !== self.location.origin) {
        await self.clients.openWindow(target)
        return
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const index = pickClientIndex(windows, target)
      if (index >= 0) {
        const client = windows[index]
        try {
          await client.focus()
          if (client.url !== target && 'navigate' in client) await client.navigate(target)
          return
        } catch {
          // An uncontrolled window can't be navigated from here: open a fresh one instead.
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
