import { inject, injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueEmailCodeUseCase } from '@/domain/auth/use-cases/issue-email-code.use-case'

@injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueEmailCode: IssueEmailCodeUseCase,
  ) {}

  // Answers the same for an unknown email: the caller learns nothing about who has an account.
  async execute(email: string): Promise<void> {
    const user = await this.users.findByEmail(User.normalizeEmail(email))

    if (user !== null) {
      await this.issueEmailCode.execute(user, 'reset-password')
    }
  }
}
