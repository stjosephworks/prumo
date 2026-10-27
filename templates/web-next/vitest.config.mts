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
    env: { NEXT_PUBLIC_API_URL: 'http://api.test' },
  },
})
