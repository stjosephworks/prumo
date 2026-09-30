import type { Profile } from '@/domain/users/entities/profile.entity'
import type { ProfileRepository } from '@/domain/users/repositories/profile.repository'

export class InMemoryProfileRepository implements ProfileRepository {
  readonly rows = new Map<string, Profile>()

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.rows.get(userId) ?? null
  }

  async save(profile: Profile): Promise<void> {
    this.rows.set(profile.userId, profile)
  }
}
