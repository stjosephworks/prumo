import { inject, injectable } from 'tsyringe'
import type { UpdateProfileDto } from '@/domain/users/dto/update-profile.dto'
import type { Profile } from '@/domain/users/entities/profile.entity'
import { ProfileNotFoundError } from '@/domain/users/errors/profile-not-found.error'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'

@injectable()
export class UpdateProfileUseCase {
  constructor(@inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(userId: string, changes: UpdateProfileDto): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId)

    if (profile === null) {
      throw new ProfileNotFoundError()
    }

    profile.update(changes)
    await this.profiles.save(profile)

    return profile
  }
}
