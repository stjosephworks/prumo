import { inject, injectable } from 'tsyringe'
import type { EmailChangeDto } from '@/domain/auth/dto/email-change.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { MAILER, type Mailer } from '@/domain/auth/ports/mailer.port'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'
import { BASE_LOCALE } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

@injectable()
export class ChangeEmailUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(MAILER) private readonly mailer: Mailer,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
  ) {}

  // The code came back from the new address to the account that asked: it becomes the account's email, confirmed.
  async execute(userId: string, { email, code }: EmailChangeDto): Promise<User> {
    // The spent attempt is committed before the error is thrown, or a wrong guess would cost nothing.
    const changed = await this.transactions.run(async () => {
      const now = new Date()
      const address = User.normalizeEmail(email)
      const stored = await this.codes.lockFor('email', address, 'change-email')

      // Another account's code is not this one's to spend.
      if (stored === null || stored.userId !== userId) {
        return null
      }

      const outcome = stored.check(this.oneTimeCodes.digest(code), now)

      await this.codes.save(stored)

      // Taken since the code was sent, the address stays its owner's.
      if (outcome !== 'valid' || (await this.users.findByEmail(address)) !== null) {
        return null
      }

      const user = await this.users.findById(userId)

      if (user === null) {
        return null
      }

      const previous = user.email

      user.changeEmail(address, now)
      await this.users.save(user)

      return { user, previous }
    })

    if (changed === null) {
      throw new InvalidCodeError()
    }

    // The previous address learns of it without learning the new one, so a change its owner did not make is noticed,
    // in the account's language.
    if (changed.previous !== null) {
      const profile = await this.profiles.findByUserId(userId)
      const { subject, text } = messagesFor(profile?.locale ?? BASE_LOCALE).mail.emailChanged

      await this.mailer.send({ to: changed.previous, subject, text })
    }

    return changed.user
  }
}
