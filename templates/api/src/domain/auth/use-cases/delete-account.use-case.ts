import { inject, injectable } from 'tsyringe'
// prumo:apple
import { ProviderConfirmationRequiredError } from '@/domain/auth/errors/provider-confirmation-required.error'
import {
  IDENTITY_PROVIDERS,
  type IdentityProviders,
} from '@/domain/auth/ports/identity-providers.port'
import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
} from '@/domain/auth/repositories/identity.repository'
// prumo:end-apple
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
    @inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository, // prumo:apple
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders, // prumo:apple
  ) {}

  // The person and everything about them, at their own request, after a sign-in of moments ago.
  async execute(userId: string, sessionId: string): Promise<void> {
    // prumo:apple
    // Apple requires its authorization revoked with the account, which takes signing in with Apple once more; that
    // trip proves the person as a recent sign-in would, and deletes the account when it comes back.
    const identities = await this.identities.findByUser(userId)

    if (
      (this.providers.isConfigured('apple') || this.providers.isNativeConfigured('apple')) &&
      identities.some((identity) => identity.provider === 'apple')
    ) {
      throw new ProviderConfirmationRequiredError('apple')
    }

    // prumo:end-apple
    await this.requireRecentSignIn.execute(sessionId)
    await this.deleteNow(userId)
  }

  // Deletes, once the person was proved: their sessions, codes and identities go with the user row; what the
  // application keeps is removed here first, on purpose.
  async deleteNow(userId: string): Promise<void> {
    await this.transactions.run(async () => {
      // What the application holds about this person is deleted or anonymised here, before the user row: a table
      // that refers to the user restricts the deletion, so nothing the project keeps disappears unnoticed. Keep only
      // what a law or a contract says must stay, without what identifies them.
      await this.deleteProfile.execute(userId)

      await this.users.delete(userId)
    })
  }
}
