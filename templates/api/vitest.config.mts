import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: { '@': `${import.meta.dirname}/src`, '@test': `${import.meta.dirname}/test` },
  },
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: ['./test/support/setup.ts'],
    pool: 'forks',
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
