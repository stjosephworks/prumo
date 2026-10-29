import type { Profile } from '@/domain/users/entities/profile.entity'

export interface ProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>
  save(profile: Profile): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}

export const PROFILE_REPOSITORY = Symbol('ProfileRepository')
