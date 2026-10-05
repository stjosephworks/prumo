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

export type SocialCallback = {
  provider: ProviderName
  state: string
  browserToken: string | undefined
  callbackUrl: URL
  name: string | null
}

export type SocialOutcome =
  | { client: 'web'; returnTo: string; tokens: SessionTokens }
  | { client: 'mobile'; code: string }

@injectable()
export class CompleteSocialSignInUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly linkIdentity: LinkIdentityUseCase,
    private readonly startSession: StartSessionUseCase,
  ) {}

  async execute(callback: SocialCallback): Promise<SocialOutcome> {
    const browser =
      callback.browserToken === undefined ? null : SocialSignIn.parseToken(callback.browserToken)

    // The browser that comes back must be the one that left: a callback forwarded from elsewhere carries no token.
    if (browser === null || browser.id !== callback.state) {
      throw new SocialSignInFailedError('The sign-in was started in another browser. Start again.')
    }

    const started = await this.transactions.run(async () => {
      const signIn = await this.signIns.lockById(browser.id)

      return signIn !== null &&
        signIn.provider === callback.provider &&
        signIn.isStarted(new Date()) &&
        signIn.browserHash === this.opaque.digest(browser.secret)
        ? signIn
        : null
    })

    if (started === null) {
      throw new SocialSignInFailedError()
    }

    const profile = await this.providers.profile(callback.provider, {
      callbackUrl: callback.callbackUrl,
      state: started.id,
      codeVerifier: started.codeVerifier,
      nonce: started.nonce,
      name: callback.name,
    })
    const userId = await this.linkIdentity.execute(callback.provider, profile)
    const exchange = started.client === 'mobile' ? this.opaque.create() : null

    await this.transactions.run(async () => {
      const signIn = await this.signIns.lockById(started.id)

      // Another callback for the same trip got here first.
      if (signIn === null || !signIn.isStarted(new Date())) {
        throw new SocialSignInFailedError()
      }

      signIn.signIn(userId, exchange === null ? null : this.opaque.digest(exchange), new Date())
      await this.signIns.save(signIn)
    })

    if (exchange !== null) {
      return { client: 'mobile', code: started.token(exchange) }
    }

    return {
      client: 'web',
      returnTo: started.returnTo,
      tokens: await this.startSession.execute(userId),
    }
  }
}
