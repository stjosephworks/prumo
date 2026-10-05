import { z } from 'zod'

export const verifyEmailSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
})

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>
