import { z } from 'zod'

const schema = z.object({
  PUBLIC_API_URL: z.url(),
})

// Astro exposes to the browser only what starts with PUBLIC_.
export const config = schema.parse(import.meta.env)
