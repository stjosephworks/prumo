import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
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
    env: { NEXT_PUBLIC_API_URL: 'http://api.test' },
  },
})
