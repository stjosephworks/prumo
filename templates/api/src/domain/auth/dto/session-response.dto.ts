import { z } from 'zod'

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    // biome-ignore format: one member a line, so cutting a feature cuts its own
    email: z.union([
      z.string(),
      z.null(), // prumo:phone-code
    ]),
    phone: z.string().nullable(), // prumo:phone-code
  }),
})

export type SessionResponseDto = z.infer<typeof sessionResponseSchema>
