import { z } from 'zod'

// The web sends its refresh token as a cookie and no body, which Fastify hands over as null; a native client
// sends it here.
export const refreshSchema = z
  .strictObject({ refreshToken: z.string().min(1).optional() })
  .nullish()

export type RefreshDto = z.infer<typeof refreshSchema>
