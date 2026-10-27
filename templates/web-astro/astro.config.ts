import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Every page is built ahead of time, which is Astro's default. A page that must render per request needs an adapter,
// such as @astrojs/node, and `export const prerender = false`.
export default defineConfig({
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
})
