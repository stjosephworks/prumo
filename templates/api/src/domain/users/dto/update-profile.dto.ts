import { z } from 'zod'
import { DISPLAY_NAME_MAX, LOCALES } from '@/domain/users/entities/profile.entity'

export const updateProfileSchema = z.strictObject({
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX).optional(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().max(64).optional(),
})

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
