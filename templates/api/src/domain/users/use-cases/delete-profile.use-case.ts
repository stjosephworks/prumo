import { inject, injectable } from 'tsyringe'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'

@injectable()
export class DeleteProfileUseCase {
  constructor(@inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(userId: string): Promise<void> {
    await this.profiles.deleteByUserId(userId)
  }
}
