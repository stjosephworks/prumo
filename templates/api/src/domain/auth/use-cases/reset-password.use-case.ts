import { inject, injectable } from 'tsyringe'
import type { ResetPasswordDto } from '@/domain/auth/dto/reset-password.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import { PASSWORD_HASHER, type PasswordHasher } from '@/domain/auth/ports/password-hasher.port'
import {
  EMAIL_CODE_REPOSITORY,
  type EmailCodeRepository,
} from '@/domain/auth/repositories/email-code.repository'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

@injectable()
export class ResetPasswordUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(EMAIL_CODE_REPOSITORY) private readonly codes: EmailCodeRepository,
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly startSession: StartSessionUseCase,
  ) {}

  async execute({ email, code, password }: ResetPasswordDto): Promise<SessionTokens> {
    const passwordHash = await this.hasher.hash(password)

    const reset = await this.transactions.run(async () => {
      const now = new Date()
      const user = await this.users.findByEmail(User.normalizeEmail(email))
      const stored = user === null ? null : await this.codes.lockFor(user.id, 'reset-password')

      if (user === null || stored === null) {
        return null
      }

      const outcome = stored.check(this.oneTimeCodes.digest(code), now)

      await this.codes.save(stored)

      if (outcome !== 'valid') {
        return null
      }

      // The code arrived in the inbox, which is the proof verification asks for.
      user.changePassword(passwordHash)
      user.verifyEmail(now)
      await this.users.save(user)
      // Whoever knew the old password may still hold a session it opened.
      await this.sessions.revokeAllFor(user.id, now)

      return user
    })

    if (reset === null) {
      throw new InvalidCodeError()
    }

    return this.startSession.execute(reset.id)
  }
}
