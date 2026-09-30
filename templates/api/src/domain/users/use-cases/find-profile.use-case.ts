import { inject, injectable } from 'tsyringe'
import type { Profile } from '@/domain/users/entities/profile.entity'
import { ProfileNotFoundError } from '@/domain/users/errors/profile-not-found.error'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'

@injectable()
export class FindProfileUseCase {
  constructor(@inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(userId: string): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId)

    if (profile === null) {
      throw new ProfileNotFoundError()
    }

    return profile
  }
}
