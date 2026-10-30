import { inject, injectable } from 'tsyringe'
import type { PhoneChangeDto } from '@/domain/auth/dto/phone-change.dto'
import type { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import { PHONE_NUMBERS, type PhoneNumbers } from '@/domain/auth/ports/phone-numbers.port'
import { TEXT_MESSAGES, type TextMessages } from '@/domain/auth/ports/text-messages.port'
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
// prumo:multi-language
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'
// prumo:end-multi-language
import { BASE_LOCALE } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

@injectable()
export class ChangePhoneUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(PHONE_NUMBERS) private readonly phones: PhoneNumbers,
    @inject(TEXT_MESSAGES) private readonly texts: TextMessages,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository, // prumo:multi-language
  ) {}

  // The code came back from the new number to the account that asked: it becomes the account's phone, confirmed.
  async execute(userId: string, { phone, code }: PhoneChangeDto): Promise<User> {
    const read = this.phones.read(phone)

    if ('problem' in read) {
      throw new InvalidCodeError()
    }

    // The spent attempt is committed before the error is thrown, or a wrong guess would cost nothing.
    const changed = await this.transactions.run(async () => {
      const now = new Date()
      const stored = await this.codes.lockFor('phone', read.e164, 'change-phone')

      // Another account's code is not this one's to spend.
      if (stored === null || stored.userId !== userId) {
        return null
      }

      const outcome = stored.check(this.oneTimeCodes.digest(code), now)

      await this.codes.save(stored)

      // Taken since the code was sent, the number stays its owner's.
      if (outcome !== 'valid' || (await this.users.findByPhone(read.e164)) !== null) {
        return null
      }

      const user = await this.users.findById(userId)

      if (user === null) {
        return null
      }

      const previous = user.phone

      user.changePhone(read.e164, now)
      await this.users.save(user)

      return { user, previous }
    })

    if (changed === null) {
      throw new InvalidCodeError()
    }

    // The previous number learns of it without learning the new one.
    // It is written in the account's language. // prumo:multi-language
    if (changed.previous !== null) {
      const profile = await this.profiles.findByUserId(userId) // prumo:multi-language

      await this.texts.send({
        to: changed.previous,
        text: messagesFor(profile?.locale ?? BASE_LOCALE).texts.phoneChanged,
      })
    }

    return changed.user
  }
}
