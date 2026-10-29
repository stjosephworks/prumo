import { inject, injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case'
import { RequireRecentSignInUseCase } from '@/domain/auth/use-cases/require-recent-sign-in.use-case'

@injectable()
export class RequestEmailChangeUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly requireRecentSignIn: RequireRecentSignInUseCase,
    private readonly issueCode: IssueCodeUseCase,
  ) {}

  // Only an address nobody has gets the code, and the answer is the same either way: asking cannot be used to find
  // out who has an account, even by someone signed in.
  async execute(userId: string, sessionId: string, email: string): Promise<void> {
    await this.requireRecentSignIn.execute(sessionId)

    const address = User.normalizeEmail(email)
    const taken = (await this.users.findByEmail(address)) !== null

    await this.issueCode.execute({ channel: 'email', destination: address }, 'change-email', {
      deliver: !taken,
      userId,
    })
  }
}
