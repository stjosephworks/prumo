import { inject, injectable } from 'tsyringe'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import {
  IDENTITY_PROVIDERS,
  type IdentityProviders,
} from '@/domain/auth/ports/identity-providers.port'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

@injectable()
export class ResumeAccountDeletionUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
  ) {}

  // The browser presents the ticket and is sent to Apple; it keeps the ticket, which the callback must bring back.
  async execute(ticket: string): Promise<string> {
    const parsed = SocialSignIn.parseToken(ticket)

    return this.transactions.run(async () => {
      const signIn = parsed === null ? null : await this.signIns.lockById(parsed.id)

      if (
        parsed === null ||
        signIn === null ||
        signIn.intent !== 'delete' ||
        !signIn.isStarted(new Date()) ||
        signIn.browserHash !== this.opaque.digest(parsed.secret)
      ) {
        throw new SocialSignInFailedError('deletionLinkExpired')
      }

      const redirect = await this.providers.redirect(signIn.provider, signIn.id)

      signIn.prepare(redirect.codeVerifier, redirect.nonce)
      await this.signIns.save(signIn)

      return redirect.url
    })
  }
}
