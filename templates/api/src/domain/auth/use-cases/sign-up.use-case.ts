import { inject, injectable } from 'tsyringe'
import type { SignUpDto } from '@/domain/auth/dto/sign-up.dto'
import { User } from '@/domain/auth/entities/user.entity'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'
import { PASSWORD_HASHER, type PasswordHasher } from '@/domain/auth/ports/password-hasher.port'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { IssueEmailCodeUseCase } from '@/domain/auth/use-cases/issue-email-code.use-case' // prumo:email
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'

@injectable()
export class SignUpUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly createProfile: CreateProfileUseCase,
    private readonly startSession: StartSessionUseCase,
    private readonly issueEmailCode: IssueEmailCodeUseCase, // prumo:email
  ) {}

  // Null when the account must confirm its email before it may sign in.
  async execute({ name, email, password }: SignUpDto): Promise<SessionTokens | null> {
    const passwordHash = await this.hasher.hash(password)

    // The account and its profile exist together or not at all.
    const user = await this.transactions.run(async () => {
      if ((await this.users.findByEmail(User.normalizeEmail(email))) !== null) {
        throw new EmailTakenError()
      }

      const user = new User(email, passwordHash)

      await this.users.save(user)
      await this.createProfile.execute(user.id, name)

      return user
    })

    // prumo:email
    // Until the address is confirmed the account cannot sign in, so it opens no session either.
    if (user.emailVerifiedAt === null) {
      await this.issueEmailCode.execute(user, 'verify-email')
      return null
    }

    // prumo:end-email
    return this.startSession.execute(user.id)
  }
}
