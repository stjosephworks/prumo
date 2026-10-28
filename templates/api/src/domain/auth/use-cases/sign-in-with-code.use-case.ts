import { inject, injectable } from 'tsyringe'
import type { EmailSignInDto } from '@/domain/auth/dto/email-sign-in.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
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
import { Profile } from '@/domain/users/entities/profile.entity'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'

@injectable()
export class SignInWithCodeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly createProfile: CreateProfileUseCase,
    private readonly startSession: StartSessionUseCase,
  ) {}

  // Signs in the account the address belongs to, or creates it: the code proved the inbox either way.
  async execute({ email, code, locale, timezone }: EmailSignInDto): Promise<SessionTokens> {
    // The spent attempt is committed before the error is thrown, or a wrong guess would cost nothing.
    const userId = await this.transactions.run(async () => {
      const now = new Date()
      const address = User.normalizeEmail(email)
      const stored = await this.codes.lockFor('email', address, 'sign-in')

      if (stored === null) {
        return null
      }

      const outcome = stored.check(this.oneTimeCodes.digest(code), now)

      await this.codes.save(stored)

      if (outcome !== 'valid') {
        return null
      }

      const existing = await this.users.findByEmail(address)

      if (existing !== null) {
        if (existing.proveEmail(now)) {
          await this.users.save(existing)
          await this.sessions.revokeAllFor(existing.id, now)
        }

        return existing.id
      }

      // Created only now, never when the code was sent: an address that never comes back leaves no account.
      const user = new User({ email: address })

      user.verifyEmail(now)
      await this.users.save(user)
      await this.createProfile.execute(user.id, Profile.nameFor(address), { locale, timezone })

      return user.id
    })

    if (userId === null) {
      throw new InvalidCodeError()
    }

    return this.startSession.execute(userId)
  }
}
