import { inject, injectable } from 'tsyringe'
import { InvalidPhoneError } from '@/domain/auth/errors/invalid-phone.error'
import { PHONE_NUMBERS, type PhoneNumbers } from '@/domain/auth/ports/phone-numbers.port'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'

@injectable()
export class RequestPhoneCodeUseCase {
  constructor(
    @inject(PHONE_NUMBERS) private readonly phones: PhoneNumbers,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Every number gets its code, with an account or not: entering it signs in, or creates the account.
  async execute(phone: string): Promise<void> {
    const read = this.phones.read(phone)

    if ('problem' in read) {
      throw new InvalidPhoneError(read.problem)
    }

    await this.issueCode.execute({ channel: 'phone', destination: read.e164 }, 'sign-in', {
      deliver: true,
    })
  }
}
