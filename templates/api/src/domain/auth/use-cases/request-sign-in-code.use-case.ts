import { injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'

@injectable()
export class RequestSignInCodeUseCase {
  constructor(private readonly issueCode: IssueCodeUseCase) {}

  // Every address gets its code, with an account or not: entering it signs in, or creates the account.
  async execute(email: string): Promise<void> {
    await this.issueCode.execute(User.normalizeEmail(email), 'sign-in', { deliver: true })
  }
}
