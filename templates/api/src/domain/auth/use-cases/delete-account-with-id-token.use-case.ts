import { inject, injectable } from 'tsyringe'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import {
  IDENTITY_PROVIDERS,
  type IdentityProviders,
  type ProviderName,
} from '@/domain/auth/ports/identity-providers.port'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
} from '@/domain/auth/repositories/identity.repository'
import {
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'
import { DeleteAccountUseCase } from '@/domain/auth/use-cases/delete-account.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

export type IdTokenDeletion = {
  userId: string
  provider: ProviderName
  trip: string
  idToken: string
  // What the sheet gave beside the token, traded for the token that is revoked.
  code: string
}

// Deleting the account from the app: the provider's own sheet confirmed, on a trip bound to the account, that the
// provider's account is the person's, so its authorization is revoked and the account deleted.
@injectable()
export class DeleteAccountWithIdTokenUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly deleteAccount: DeleteAccountUseCase,
  ) {}

  async execute({ userId, provider, trip, idToken, code }: IdTokenDeletion): Promise<void> {
    const parsed = SocialSignIn.parseToken(trip)
    const started = await this.transactions.run(async () =>
      parsed === null ? null : this.signIns.lockById(parsed.id),
    )

    if (
      parsed === null ||
      started === null ||
      started.provider !== provider ||
      started.intent !== 'delete' ||
      started.userId !== userId ||
      !started.isStarted(new Date()) ||
      started.browserHash !== this.opaque.digest(parsed.secret)
    ) {
      throw new SocialSignInFailedError('deletionConfirmationExpired')
    }

    const profile = await this.providers.verify(provider, {
      idToken,
      nonce: started.nonce,
      name: null,
    })
    const identity = await this.identities.findBySubject(provider, profile.subject)

    // Checked before revoking, so another account's authorization is never touched.
    if (identity?.userId !== userId) {
      throw new SocialSignInFailedError('notTheAccountBeingDeleted')
    }

    await this.providers.revokeNative(provider, code)
    await this.deleteAccount.deleteNow(userId)
  }
}
