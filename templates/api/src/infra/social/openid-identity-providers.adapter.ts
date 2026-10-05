import { importPKCS8, SignJWT } from 'jose'
import * as oidc from 'openid-client'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import type {
  IdentityProviders,
  ProviderCallback,
  ProviderName,
  ProviderProfile,
  ProviderRedirect,
} from '@/domain/auth/ports/identity-providers.port'
import { DomainError } from '@/domain/shared/errors/domain-error'
import type { Env } from '@/infra/config/env'

type Settings = {
  issuer: URL
  clientId: string
  scope: string
  // Apple answers with a POST when the email is asked for; Google redirects back with a GET.
  formPost: boolean
  secret: () => Promise<string>
}

type Options = {
  // A test points a provider at a local issuer, over plain HTTP.
  issuers?: Partial<Record<ProviderName, URL>>
  insecure?: boolean
}

// Apple accepts a client secret valid for up to six months; one hour keeps a leaked one short-lived.
const SECRET_LIFETIME_MS = 60 * 60 * 1000

export class OpenIdIdentityProviders implements IdentityProviders {
  private readonly configurations = new Map<
    ProviderName,
    { configuration: oidc.Configuration; until: number }
  >()

  constructor(
    private readonly env: Env,
    private readonly options: Options = {},
  ) {}

  private settings(provider: ProviderName): Settings | null {
    const { env } = this
    const issuer = (fallback: string) => this.options.issuers?.[provider] ?? new URL(fallback)

    switch (provider) {
      // prumo:google
      case 'google': {
        const secret = env.GOOGLE_CLIENT_SECRET

        return env.GOOGLE_CLIENT_ID === undefined || secret === undefined
          ? null
          : {
              issuer: issuer('https://accounts.google.com'),
              clientId: env.GOOGLE_CLIENT_ID,
              scope: 'openid email profile',
              formPost: false,
              secret: async () => secret,
            }
      }
      // prumo:end-google
      // prumo:apple
      case 'apple': {
        const { APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = env

        if (
          APPLE_CLIENT_ID === undefined ||
          APPLE_TEAM_ID === undefined ||
          APPLE_KEY_ID === undefined ||
          APPLE_PRIVATE_KEY === undefined
        ) {
          return null
        }

        return {
          issuer: issuer('https://appleid.apple.com'),
          clientId: APPLE_CLIENT_ID,
          scope: 'openid email name',
          formPost: true,
          // Apple's client secret is a JWT signed with the team's .p8 key, not a string it hands out.
          secret: async () =>
            new SignJWT({})
              .setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID })
              .setIssuer(APPLE_TEAM_ID)
              .setSubject(APPLE_CLIENT_ID)
              .setAudience('https://appleid.apple.com')
              .setIssuedAt()
              .setExpirationTime(Math.floor((Date.now() + SECRET_LIFETIME_MS) / 1000))
              .sign(await importPKCS8(APPLE_PRIVATE_KEY.replaceAll('\\n', '\n'), 'ES256')),
        }
      }
      // prumo:end-apple
    }

    return null
  }

  private redirectUri(provider: ProviderName): string {
    return `${this.env.API_URL}/api/auth/social/${provider}/callback`
  }

  private async configuration(provider: ProviderName, settings: Settings) {
    const cached = this.configurations.get(provider)

    if (cached !== undefined && cached.until > Date.now()) {
      return cached.configuration
    }

    const configuration = await oidc.discovery(
      settings.issuer,
      settings.clientId,
      undefined,
      oidc.ClientSecretPost(await settings.secret()),
      { execute: this.options.insecure === true ? [oidc.allowInsecureRequests] : [] },
    )

    // Renewed before the secret it was built with expires.
    this.configurations.set(provider, {
      configuration,
      until: Date.now() + SECRET_LIFETIME_MS / 2,
    })

    return configuration
  }

  isConfigured(provider: ProviderName): boolean {
    return this.settings(provider) !== null
  }

  async redirect(provider: ProviderName, state: string): Promise<ProviderRedirect> {
    const settings = this.settings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError(`Sign-in with ${provider} is not configured`)
    }

    const configuration = await this.configuration(provider, settings)
    const nonce = oidc.randomNonce()
    // PKCE where the provider says it takes it: Google does, Apple's metadata names none, and relies on state and nonce.
    const codeVerifier = configuration.serverMetadata().supportsPKCE()
      ? oidc.randomPKCECodeVerifier()
      : null
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri(provider),
      scope: settings.scope,
      state,
      nonce,
      ...(codeVerifier !== null && {
        code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
      }),
      ...(settings.formPost && { response_mode: 'form_post' }),
    })

    return { url: url.href, codeVerifier, nonce }
  }

  async profile(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile> {
    const settings = this.settings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError(`Sign-in with ${provider} is not configured`)
    }

    try {
      const tokens = await oidc.authorizationCodeGrant(
        await this.configuration(provider, settings),
        callback.callbackUrl,
        {
          expectedState: callback.state,
          expectedNonce: callback.nonce,
          idTokenExpected: true,
          ...(callback.codeVerifier !== null && { pkceCodeVerifier: callback.codeVerifier }),
        },
      )
      // Read only after openid-client checked the ID token's signature, issuer, audience, expiry and nonce.
      const claims = tokens.claims()

      if (claims === undefined || typeof claims.email !== 'string') {
        throw new SocialSignInFailedError('The provider did not share an email address')
      }

      return {
        subject: claims.sub,
        email: claims.email,
        // Apple writes it as the string "true".
        emailVerified: claims.email_verified === true || claims.email_verified === 'true',
        name: typeof claims.name === 'string' ? claims.name : callback.name,
      }
    } catch (error) {
      if (error instanceof DomainError) {
        throw error
      }

      throw new SocialSignInFailedError()
    }
  }
}
