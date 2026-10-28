import { z } from 'zod'

// As typed, in international form; the API reads it as E.164 and refuses what is no mobile number it texts.
export const phoneRequestSchema = z.strictObject({ phone: z.string().trim().min(1).max(32) })

export type PhoneRequestDto = z.infer<typeof phoneRequestSchema>
