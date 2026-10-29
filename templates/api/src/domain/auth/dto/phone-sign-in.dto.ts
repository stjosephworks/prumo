import { z } from 'zod'

export const phoneSignInSchema = z.strictObject({
  phone: z.string().trim().min(1).max(32),
  code: z.string().regex(/^\d{6}$/),
  // The device's, used only when this code creates the account: a language the project lacks becomes its base.
  locale: z.string().max(35).optional(),
  timezone: z.string().max(64).optional(),
})

export type PhoneSignInDto = z.infer<typeof phoneSignInSchema>
