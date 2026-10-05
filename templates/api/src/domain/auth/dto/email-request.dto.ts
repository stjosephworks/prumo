import { z } from 'zod'

export const emailRequestSchema = z.strictObject({ email: z.email().max(254) })

export type EmailRequestDto = z.infer<typeof emailRequestSchema>
