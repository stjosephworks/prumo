import { z } from 'zod'

// What a native client receives instead of cookies. `expiresIn` is in seconds, as OAuth writes it.
export const tokensResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
})

export type TokensResponseDto = z.infer<typeof tokensResponseSchema>
