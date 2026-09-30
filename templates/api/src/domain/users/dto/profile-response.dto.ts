import { z } from 'zod'
import { LOCALES } from '@/domain/users/entities/profile.entity'

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
