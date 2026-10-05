import { z } from 'zod'

export const resetPasswordSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(128),
})

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>
