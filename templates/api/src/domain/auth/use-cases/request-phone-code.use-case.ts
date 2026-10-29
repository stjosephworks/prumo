import { inject, injectable } from 'tsyringe'
import { InvalidPhoneError } from '@/domain/auth/errors/invalid-phone.error'
import { PHONE_NUMBERS, type PhoneNumbers } from '@/domain/auth/ports/phone-numbers.port'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'
import type { Locale } from '@/i18n/locales'

@injectable()
export class RequestPhoneCodeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(PHONE_NUMBERS) private readonly phones: PhoneNumbers,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Every number gets its code, with an account or not: entering it signs in, or creates the account. An account's
  // code is written in its language; anyone else's in the one they asked in.
  async execute(phone: string, locale: Locale): Promise<void> {
    const read = this.phones.read(phone)

    if ('problem' in read) {
      throw new InvalidPhoneError(read.problem)
    }

    const user = await this.users.findByPhone(read.e164)

    await this.issueCode.execute({ channel: 'phone', destination: read.e164 }, 'sign-in', {
      deliver: true,
      account: user?.id ?? null,
      locale,
    })
  }
}
