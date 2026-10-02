import { inject, injectable } from 'tsyringe'
import type { User } from '@/domain/auth/entities/user.entity'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'

@injectable()
export class FindUserUseCase {
  constructor(@inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId)

    // A valid token for a user who no longer exists is a session that should have ended.
    if (user === null) {
      throw new InvalidSessionError()
    }

    return user
  }
}
