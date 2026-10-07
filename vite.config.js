import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { SHORTCUTS, splashLinkTags } from './scripts/pwa-assets.mjs'

// iPhone launch screens: scripts/generate-pwa-icons.mjs draws them, this names them in index.html.
const iosSplashLinks = () => ({
  name: 'ios-splash-links',
  transformIndexHtml: (html) => html.replace('<!-- pwa:ios-splash -->', splashLinkTags()),
})

export default defineConfig({
  plugins: [
    react(),
    iosSplashLinks(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      // 'prompt' (not 'autoUpdate'): a new SW waits until the user accepts an in-app prompt
      // instead of auto-claiming open tabs. Registration is done manually in src/services/pwa.ts
      // (via virtual:pwa-register), so disable the auto-injected registerSW to avoid double-register.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'logo.svg', 'icons/*.png'],
      manifest: {
        // The identity Chrome keys an install on: what start_url "/" already resolved to, so
        // existing installs stay the same app.
        id: '/',
        name: 'Master LMS',
        short_name: 'Master LMS',
        description: 'Lessons, homework and reminders from Master Education.',
        lang: 'en',
        categories: ['education'],
        // White like the light theme and the icon's own background; the page's theme-color
        // metas (index.html, ThemeProvider) take over in dark mode once it loads.
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          ...[72, 96, 128, 144, 152, 180, 192, 384, 512].map((size) => ({
            src: `/icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any',
          })),
          // Logo shrunk into the safe zone, so Android's round/squircle masks never crop it.
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Shown by Chrome's richer install dialog. Made-up demo data from a local stack.
        screenshots: [
          { src: '/screenshots/dashboard-narrow.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'Your dashboard on a phone' },
          { src: '/screenshots/dashboard-wide.webp', sizes: '1440x900', type: 'image/webp', form_factor: 'wide', label: 'Your dashboard on a computer' },
        ],
        shortcuts: SHORTCUTS.map(({ name, short_name, url, file }) => ({
          name,
          ...(short_name ? { short_name } : {}),
          url,
          icons: [{ src: file, sizes: '96x96', type: 'image/png' }],
        })),
      },
      injectManifest: {
        rollupFormat: 'iife',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
      },
    }),
  ],
  build: {
    rollupOptions: {
      // The Google Meet add-on side panel is its own small entry (src/meet-addon): Meet waits at
      // most 10 s for it, so it never loads the main app's router, providers or service worker.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'meet-addon': path.resolve(__dirname, 'meet-addon.html'),
      },
    },
  },
  // NOTE: no manual `manualChunks`. Route-level React.lazy (see src/routes/Router.tsx) already
  // keeps the initial download small, and Rollup's automatic chunking splits shared vendors while
  // guaranteeing correct chunk evaluation order. A hand-rolled split that put React in its own
  // chunk separate from recharts broke module init at runtime ("can't access property forwardRef
  // of undefined") because the charts chunk evaluated before React was defined — don't reintroduce it.
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: [
      // Alias for @/ imports (shadcn/ui components)
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ]
  },
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[jt]sx?$/,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx',
      },
    },
  },
  ssr: {
    noExternal: ['motion']
  }
}) 