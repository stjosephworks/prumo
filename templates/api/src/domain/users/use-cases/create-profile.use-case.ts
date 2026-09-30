import { inject, injectable } from 'tsyringe'
import { Profile } from '@/domain/users/entities/profile.entity'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'

@injectable()
export class CreateProfileUseCase {
  constructor(@inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(userId: string, displayName: string): Promise<Profile> {
    const profile = new Profile(userId, displayName)

    await this.profiles.save(profile)

    return profile
  }
}
