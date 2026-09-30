import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': `${import.meta.dirname}/src`, '@test': `${import.meta.dirname}/test` },
  },
  test: { globals: true, include: ['test/**/*.spec.{ts,tsx}'] },
})
