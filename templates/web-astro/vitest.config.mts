/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config'

// Astro's own Vite configuration, so a test resolves `@/` and reads PUBLIC_ variables as the build does.
export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/support/setup.ts'],
    env: { PUBLIC_API_URL: 'http://api.test' },
  },
})
