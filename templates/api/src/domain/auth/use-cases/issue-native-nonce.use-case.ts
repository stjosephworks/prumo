import { inject, injectable } from 'tsyringe'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
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

export type NativeTrip = { trip: string; nonce: string }

@injectable()
export class IssueNativeNonceUseCase {
  constructor(
    @inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
  ) {}

  // A nonce for a provider's own sheet, which writes it into the token it gives, and the trip the app sends back with
  // that token: the token is good for this trip only, and once. Bound to an account, the trip deletes it instead.
  async execute({
    provider,
    userId = null,
  }: {
    provider: ProviderName
    userId?: string | null
  }): Promise<NativeTrip> {
    if (!this.providers.isNativeConfigured(provider)) {
      throw new ProviderNotConfiguredError(provider)
    }

    const secret = this.opaque.create()
    const nonce = this.opaque.create()
    const signIn = new SocialSignIn(provider, 'mobile', '/', this.opaque.digest(secret), new Date())

    signIn.prepare(null, nonce)

    if (userId !== null) {
      signIn.forDeletion(userId)
    }

    // Saved first: the token the app keeps names it by its id.
    await this.signIns.save(signIn)

    return { trip: signIn.token(secret), nonce }
  }
}
