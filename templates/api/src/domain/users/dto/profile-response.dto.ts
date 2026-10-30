import { z } from 'zod'
import { LOCALES } from '@/i18n/locales'

export const profileResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  displayName: z.string(),
  locale: z.enum(LOCALES),
  timezone: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ProfileResponseDto = z.infer<typeof profileResponseSchema>
