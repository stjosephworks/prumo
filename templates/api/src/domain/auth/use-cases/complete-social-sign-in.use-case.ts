import { inject, injectable } from 'tsyringe'
import { type SocialClient, SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import {
  IDENTITY_PROVIDERS,
  type IdentityProviders,
  type ProviderName,
} from '@/domain/auth/ports/identity-providers.port'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
// prumo:apple
import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
} from '@/domain/auth/repositories/identity.repository'
// prumo:end-apple
import {
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'
import { DeleteAccountUseCase } from '@/domain/auth/use-cases/delete-account.use-case' // prumo:apple
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

export type SocialCallback = {
  provider: ProviderName
  state: string
  browserToken: string | undefined
  callbackUrl: URL
  name: string | null
  // prumo:multi-language
  // The language the browser asked in, which an account created here starts in.
  locale: Locale
  // prumo:end-multi-language
}

// biome-ignore format: one member a line, so cutting a feature cuts its own
export type SocialOutcome =
  | { client: 'web'; returnTo: string; tokens: SessionTokens }
  | { client: 'mobile'; code: string }
  | { client: SocialClient; deleted: true } // prumo:apple

@injectable()
export class CompleteSocialSignInUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly linkIdentity: LinkIdentityUseCase,
    private readonly startSession: StartSessionUseCase,
    @inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository, // prumo:apple
    private readonly deleteAccount: DeleteAccountUseCase, // prumo:apple
  ) {}

  async execute(callback: SocialCallback): Promise<SocialOutcome> {
    const browser =
      callback.browserToken === undefined ? null : SocialSignIn.parseToken(callback.browserToken)

    // The browser that comes back must be the one that left: a callback forwarded from elsewhere carries no token.
    if (browser === null || browser.id !== callback.state) {
      throw new SocialSignInFailedError('signInStartedElsewhere')
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

    // prumo:apple
    if (started.intent === 'delete' && started.userId !== null) {
      return this.completeDeletion(callback, started, started.userId)
    }

    // prumo:end-apple

    const profile = await this.providers.profile(callback.provider, {
      callbackUrl: callback.callbackUrl,
      state: started.id,
      codeVerifier: started.codeVerifier,
      nonce: started.nonce,
      name: callback.name,
    })
    const userId = await this.linkIdentity.execute(callback.provider, profile, {
      locale: callback.locale,
    })
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

  // prumo:apple
  // The provider's account must be the one linked to the account being deleted; its authorization is revoked, then
  // the account goes.
  private async completeDeletion(
    callback: SocialCallback,
    started: SocialSignIn,
    userId: string,
  ): Promise<SocialOutcome> {
    const profile = await this.providers.revoke(callback.provider, {
      callbackUrl: callback.callbackUrl,
      state: started.id,
      codeVerifier: started.codeVerifier,
      nonce: started.nonce,
      name: callback.name,
    })
    const identity = await this.identities.findBySubject(callback.provider, profile.subject)

    if (identity?.userId !== userId) {
      throw new SocialSignInFailedError('notTheAccountBeingDeleted')
    }

    await this.deleteAccount.deleteNow(userId)

    return { client: started.client, deleted: true }
  }
  // prumo:end-apple
}
