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
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'
import { LinkIdentityUseCase } from '@/domain/auth/use-cases/link-identity.use-case'
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import type { Locale } from '@/i18n/locales'

export type IdTokenSignIn = {
  provider: ProviderName
  idToken: string
  // The trip whose nonce went into the token, where the provider took one.
  trip: string | null
  name: string | null
  // The language the app asked in, which an account created here starts in.
  locale: Locale
}

// A provider's own sheet on the phone signed the person in: the token it gave the app is checked, the identity is
// linked as for a trip through the browser, and the app gets its tokens.
@injectable()
export class SignInWithIdTokenUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly linkIdentity: LinkIdentityUseCase,
    private readonly startSession: StartSessionUseCase,
  ) {}

  async execute({ provider, idToken, trip, name, locale }: IdTokenSignIn): Promise<SessionTokens> {
    const started = trip === null ? null : await this.started(provider, trip)
    const profile = await this.providers.verify(provider, {
      idToken,
      nonce: started?.nonce ?? null,
      name,
    })
    const userId = await this.linkIdentity.execute(provider, profile, { locale })

    if (started !== null) {
      await this.transactions.run(async () => {
        const signIn = await this.signIns.lockById(started.id)

        // The same token sent twice: the first got here first.
        if (signIn === null || !signIn.isStarted(new Date())) {
          throw new SocialSignInFailedError()
        }

        signIn.signIn(userId, null, new Date())
        await this.signIns.save(signIn)
      })
    }

    return this.startSession.execute(userId)
  }

  // The trip the nonce was issued for, still open, and presented by the app it was issued to.
  private async started(provider: ProviderName, token: string): Promise<SocialSignIn> {
    const parsed = SocialSignIn.parseToken(token)
    const signIn = await this.transactions.run(async () =>
      parsed === null ? null : this.signIns.lockById(parsed.id),
    )

    if (
      parsed === null ||
      signIn === null ||
      signIn.provider !== provider ||
      signIn.intent !== 'sign-in' ||
      !signIn.isStarted(new Date()) ||
      signIn.browserHash !== this.opaque.digest(parsed.secret)
    ) {
      throw new SocialSignInFailedError()
    }

    return signIn
  }
}
