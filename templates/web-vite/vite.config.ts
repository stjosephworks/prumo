import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Under Vitest (mode `test`) every route is imported with the route tree. Split, each route's component is a
// virtual module Vite transforms the first time a test renders it, inside the one second Testing Library waits for
// the page, and on a loaded machine that transform alone outlasted the wait.
export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: mode !== 'test' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': `${import.meta.dirname}/src`, '@test': `${import.meta.dirname}/test` },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/support/setup.ts'],
    // A form test renders, types and waits in jsdom. With a workspace's apps tested at once on a slow machine, Windows
    // CI among them, that crossed Vitest's 5s default while the same suite passed alone. The budget is the machine's
    // slowness, not the test's.
    testTimeout: 15_000,
    coverage: { provider: 'v8', include: ['src/**'] },
  },
}))
