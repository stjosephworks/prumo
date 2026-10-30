import { inject, injectable } from 'tsyringe'
import { InvalidPhoneError } from '@/domain/auth/errors/invalid-phone.error'
import { PHONE_NUMBERS, type PhoneNumbers } from '@/domain/auth/ports/phone-numbers.port'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'
import { RequireRecentSignInUseCase } from '@/domain/auth/use-cases/require-recent-sign-in.use-case'
import type { Locale } from '@/i18n/locales'

@injectable()
export class RequestPhoneChangeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(PHONE_NUMBERS) private readonly phones: PhoneNumbers,
    private readonly requireRecentSignIn: RequireRecentSignInUseCase,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Only a number nobody has gets the code, and the answer is the same either way.
  async execute(userId: string, sessionId: string, phone: string, locale: Locale): Promise<void> {
    await this.requireRecentSignIn.execute(sessionId)

    const read = this.phones.read(phone)

    if ('problem' in read) {
      throw new InvalidPhoneError(read.problem)
    }

    const taken = (await this.users.findByPhone(read.e164)) !== null

    await this.issueCode.execute({ channel: 'phone', destination: read.e164 }, 'change-phone', {
      deliver: !taken,
      userId,
      locale,
    })
  }
}
