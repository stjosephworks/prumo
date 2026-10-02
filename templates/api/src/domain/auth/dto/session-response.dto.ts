import { z } from 'zod'

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.string() }),
})

export type SessionResponseDto = z.infer<typeof sessionResponseSchema>
