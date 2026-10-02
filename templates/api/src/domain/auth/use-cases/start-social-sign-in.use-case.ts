import { inject, injectable } from 'tsyringe'
import { type SocialClient, SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { ProviderNotConfiguredError } from '@/domain/auth/errors/provider-not-configured.error'
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

export type SocialStart = { provider: ProviderName; client: SocialClient; returnTo: string }

@injectable()
export class StartSocialSignInUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
  ) {}

  // Returns where to send the browser, and the token the browser keeps to prove, on the way back, that it started.
  async execute({
    provider,
    client,
    returnTo,
  }: SocialStart): Promise<{ url: string; browserToken: string }> {
    if (!this.providers.isConfigured(provider)) {
      throw new ProviderNotConfiguredError(provider)
    }

    const secret = this.opaque.create()
    const signIn = new SocialSignIn(
      provider,
      client,
      returnTo,
      this.opaque.digest(secret),
      new Date(),
    )

    // Saved first: its id is the state the provider sends back.
    await this.signIns.save(signIn)

    const redirect = await this.providers.redirect(provider, signIn.id)

    signIn.prepare(redirect.codeVerifier, redirect.nonce)
    await this.signIns.save(signIn)

    return { url: redirect.url, browserToken: signIn.token(secret) }
  }
}
