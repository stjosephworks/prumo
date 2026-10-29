import { z } from 'zod'

export const emailChangeSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
})

export type EmailChangeDto = z.infer<typeof emailChangeSchema>
