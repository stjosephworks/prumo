import { inject, injectable } from 'tsyringe'
import type { SignInDto } from '@/domain/auth/dto/sign-in.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCredentialsError } from '@/domain/auth/errors/invalid-credentials.error'
import { PASSWORD_HASHER, type PasswordHasher } from '@/domain/auth/ports/password-hasher.port'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'

@injectable()
export class SignInUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly startSession: StartSessionUseCase,
  ) {}

  async execute({ email, password }: SignInDto): Promise<SessionTokens> {
    const user = await this.users.findByEmail(User.normalizeEmail(email))
    const valid = await this.hasher.verify(user?.passwordHash, password)

    if (user === null || !valid) {
      throw new InvalidCredentialsError()
    }

    return this.startSession.execute(user.id)
  }
}
