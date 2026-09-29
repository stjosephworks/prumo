import { z } from 'zod'
import { LOCALES } from '@/domain/users/entities/profile.entity'

export const updateProfileSchema = z.strictObject({
  displayName: z.string().min(1).max(80).optional(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().max(64).optional(),
})

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
