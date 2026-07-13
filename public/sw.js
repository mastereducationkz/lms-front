import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// Explicit update flow (registerType: 'prompt'). A freshly deployed service worker installs
// and then WAITS in the standard lifecycle instead of calling skipWaiting()/clientsClaim() to
// seize already-open tabs. The app posts SKIP_WAITING (via updateSW(true)) only after the user
// accepts the "new version available" prompt, so no one is reloaded or has their precache
// wiped mid-session — the pattern that kicked everyone out right after a deploy.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Runs on activation of the NEW worker (i.e. only after the user opts in), so it never deletes
// the running tab's precache out from under it.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
