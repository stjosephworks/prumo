import { inject, injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'

@injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Answers the same for an unknown email: the caller learns nothing about who has an account.
  async execute(email: string): Promise<void> {
    const address = User.normalizeEmail(email)
    const user = await this.users.findByEmail(address)

    await this.issueCode.execute(address, 'reset-password', { deliver: user !== null })
  }
}
