import { z } from 'zod'

export const phoneChangeSchema = z.strictObject({
  phone: z.string().trim().min(1).max(32),
  code: z.string().regex(/^\d{6}$/),
})

export type PhoneChangeDto = z.infer<typeof phoneChangeSchema>
