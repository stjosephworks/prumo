import { z } from 'zod'

const schema = z.object({
  VITE_API_URL: z.url(),
})

export const config = schema.parse(import.meta.env)
