import { inject, injectable } from 'tsyringe'
import type { SignInDto } from '@/domain/auth/dto/sign-in.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { EmailNotVerifiedError } from '@/domain/auth/errors/email-not-verified.error' // prumo:email
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
    const valid = await this.hasher.verify(user?.passwordHash ?? undefined, password)

    if (user === null || !valid) {
      throw new InvalidCredentialsError()
    }

    // prumo:email
    // Asked only after the password matched, so the answer says nothing to someone who does not know it.
    if (user.emailVerifiedAt === null) {
      throw new EmailNotVerifiedError()
    }

    // prumo:end-email
    return this.startSession.execute(user.id)
  }
}
