import { inject, injectable } from 'tsyringe'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import { RequireRecentSignInUseCase } from '@/domain/auth/use-cases/require-recent-sign-in.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import { DeleteProfileUseCase } from '@/domain/users/use-cases/delete-profile.use-case'

@injectable()
export class DeleteAccountUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly requireRecentSignIn: RequireRecentSignInUseCase,
    private readonly deleteProfile: DeleteProfileUseCase,
  ) {}

  // The person and everything about them, at their own request, after a sign-in of moments ago. Their sessions,
  // codes and identities go with the user row; what the application keeps is removed here first, on purpose.
  async execute(userId: string, sessionId: string): Promise<void> {
    await this.requireRecentSignIn.execute(sessionId)

    await this.transactions.run(async () => {
      // What the application holds about this person is deleted or anonymised here, before the user row: a table
      // that refers to the user restricts the deletion, so nothing the project keeps disappears unnoticed. Keep only
      // what a law or a contract says must stay, without what identifies them.
      await this.deleteProfile.execute(userId)

      await this.users.delete(userId)
    })
  }
}
