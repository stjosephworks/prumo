import { inject, injectable } from 'tsyringe'
import type { VerifyEmailDto } from '@/domain/auth/dto/verify-email.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import {
  EMAIL_CODE_REPOSITORY,
  type EmailCodeRepository,
} from '@/domain/auth/repositories/email-code.repository'
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
export class VerifyEmailUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(EMAIL_CODE_REPOSITORY) private readonly codes: EmailCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly startSession: StartSessionUseCase,
  ) {}

  // A confirmed address signs the user in: they proved the inbox and already chose a password.
  async execute({ email, code }: VerifyEmailDto): Promise<SessionTokens> {
    // The spent attempt is committed before the error is thrown, or a wrong guess would cost nothing.
    const verified = await this.transactions.run(async () => {
      const now = new Date()
      const user = await this.users.findByEmail(User.normalizeEmail(email))
      const stored = user === null ? null : await this.codes.lockFor(user.id, 'verify-email')

      if (user === null || stored === null) {
        return null
      }

      const outcome = stored.check(this.oneTimeCodes.digest(code), now)

      await this.codes.save(stored)

      if (outcome !== 'valid') {
        return null
      }

      user.verifyEmail(now)
      await this.users.save(user)

      return user
    })

    if (verified === null) {
      throw new InvalidCodeError()
    }

    return this.startSession.execute(verified.id)
  }
}
