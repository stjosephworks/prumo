import { z } from 'zod'

export const emailSignInSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
  // The device's, used only when this code creates the account: an unsupported locale becomes English.
  locale: z.string().max(35).optional(),
  timezone: z.string().max(64).optional(),
})

export type EmailSignInDto = z.infer<typeof emailSignInSchema>
