import { inject, injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'
import type { Locale } from '@/i18n/locales'

@injectable()
export class RequestSignInCodeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Every address gets its code, with an account or not: entering it signs in, or creates the account. An account's
  // code is written in its language; anyone else's in the one they asked in.
  async execute(email: string, locale: Locale): Promise<void> {
    const address = User.normalizeEmail(email)
    const user = await this.users.findByEmail(address)

    await this.issueCode.execute({ channel: 'email', destination: address }, 'sign-in', {
      deliver: true,
      account: user?.id ?? null,
      locale,
    })
  }
}
