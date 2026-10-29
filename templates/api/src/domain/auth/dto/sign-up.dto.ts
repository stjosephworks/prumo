import { z } from 'zod'

export const signUpSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  // The device's, used for the new profile only: an unsupported locale becomes English.
  locale: z.string().max(35).optional(),
  timezone: z.string().max(64).optional(),
})

export type SignUpDto = z.infer<typeof signUpSchema>
