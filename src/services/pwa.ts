import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/**
 * Registers the service worker with an explicit, user-driven update flow.
 *
 * When a new build is deployed, the waiting SW does NOT take over open tabs. Instead we show a
 * persistent toast; only if the user clicks "Обновить" do we call updateSW(true), which posts
 * SKIP_WAITING to the waiting worker and reloads once. This replaces the old auto-skipWaiting +
 * clientsClaim behavior that hijacked live sessions on every deploy.
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
    onRegisterError(error) {
      console.error('Service worker registration failed:', error)
    },
  })
}
