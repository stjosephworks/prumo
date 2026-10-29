import { inject, injectable } from 'tsyringe'
import type { PhoneSignInDto } from '@/domain/auth/dto/phone-sign-in.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import { PHONE_NUMBERS, type PhoneNumbers } from '@/domain/auth/ports/phone-numbers.port'
import { REVIEW_SIGN_INS, type ReviewSignIns } from '@/domain/auth/ports/review-sign-ins.port'
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
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
export class SignInWithPhoneCodeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(REVIEW_SIGN_INS) private readonly reviewSignIns: ReviewSignIns,
    @inject(PHONE_NUMBERS) private readonly phones: PhoneNumbers,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly createProfile: CreateProfileUseCase,
    private readonly startSession: StartSessionUseCase,
  ) {}

  // Signs in the account the number belongs to, or creates it: the code proved the phone either way.
  async execute({ phone, code, locale, timezone }: PhoneSignInDto): Promise<SessionTokens> {
    const read = this.phones.read(phone)

    // A number no code could have gone to answers as a wrong code does.
    if ('problem' in read) {
      throw new InvalidCodeError()
    }

    // The spent attempt is committed before the error is thrown, or a wrong guess would cost nothing.
    const userId = await this.transactions.run(async () => {
      const now = new Date()
      const stored = await this.codes.lockFor('phone', read.e164, 'sign-in')

      if (stored === null) {
        return null
      }

      const outcome = stored.check(
        this.oneTimeCodes.digest(code),
        now,
        this.reviewSignIns.accepts(read.e164, code),
      )

      await this.codes.save(stored)

      if (outcome !== 'valid') {
        return null
      }

      const existing = await this.users.findByPhone(read.e164)

      if (existing !== null) {
        existing.verifyPhone(now)
        await this.users.save(existing)

        return existing.id
      }

      // Created only now, never when the code was sent: a number that never comes back leaves no account.
      const user = new User({ phone: read.e164 })

      user.verifyPhone(now)
      await this.users.save(user)
      await this.createProfile.execute(user.id, Profile.nameForPhone(read.e164), {
        locale,
        timezone,
      })

      return user.id
    })

    if (userId === null) {
      throw new InvalidCodeError()
    }

    return this.startSession.execute(userId)
  }
}
