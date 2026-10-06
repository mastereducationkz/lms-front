// Separate from vite.config.js on purpose: the app config loads the PWA plugin and
// generates icons, none of which a pure-function unit test needs.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // shadcn/ui components import through `@/`, as in vite.config.js.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    // A .test.tsx that mounts a component opts into a DOM with `// @vitest-environment jsdom`.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
