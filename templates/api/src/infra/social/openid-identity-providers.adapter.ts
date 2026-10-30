import * as jose from 'jose'
import * as oidc from 'openid-client'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import type {
  IdentityProviders,
  NativeCredential,
  ProviderCallback,
  ProviderName,
  ProviderProfile,
  ProviderRedirect,
} from '@/domain/auth/ports/identity-providers.port'
import { DomainError } from '@/domain/shared/errors/domain-error'
import type { Env } from '@/infra/config/env'

// A client of the provider: the issuer, the id it knows this application by, and its secret, when it has one.
type Client = {
  issuer: URL
  clientId: string
  secret: (() => Promise<string>) | null
}

type Settings = Client & {
  scope: string
  // Apple answers with a POST when the email is asked for; Google redirects back with a GET.
  formPost: boolean
  // Apple requires its authorization revoked when the account is deleted; Google asks nothing.
  revokesOnDeletion: boolean
}

// The app's own sign-in sheet: the client is the one the provider issues the app's tokens to.
type NativeSettings = Client & {
  // Google writes its issuer with and without the scheme.
  alsoIssuers: string[]
  // Apple writes the nonce it was given into the token; Google's sheet takes none.
  nonce: boolean
  revokesOnDeletion: boolean
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
    string,
    { configuration: oidc.Configuration; until: number }
  >()
  // Each provider's signing keys, fetched once and again only when a token names a key not among them.
  private readonly keys = new Map<ProviderName, ReturnType<typeof jose.createRemoteJWKSet>>()

  constructor(
    private readonly env: Env,
    private readonly options: Options = {},
  ) {}

  private issuer(provider: ProviderName, fallback: string): URL {
    return this.options.issuers?.[provider] ?? new URL(fallback)
  }

  private settings(provider: ProviderName): Settings | null {
    const { env } = this

    switch (provider) {
      // prumo:google
      case 'google': {
        const secret = env.GOOGLE_CLIENT_SECRET

        return env.GOOGLE_CLIENT_ID === undefined || secret === undefined
          ? null
          : {
              issuer: this.issuer(provider, 'https://accounts.google.com'),
              clientId: env.GOOGLE_CLIENT_ID,
              scope: 'openid email profile',
              formPost: false,
              revokesOnDeletion: false,
              secret: async () => secret,
            }
      }
      // prumo:end-google
      // prumo:apple
      case 'apple': {
        const secret = this.appleSecret(env.APPLE_CLIENT_ID)

        return env.APPLE_CLIENT_ID === undefined || secret === null
          ? null
          : {
              issuer: this.issuer(provider, 'https://appleid.apple.com'),
              clientId: env.APPLE_CLIENT_ID,
              scope: 'openid email name',
              formPost: true,
              revokesOnDeletion: true,
              secret,
            }
      }
      // prumo:end-apple
    }

    return null
  }

  private nativeSettings(provider: ProviderName): NativeSettings | null {
    const { env } = this

    switch (provider) {
      // prumo:google
      // Google's sheet issues the app's token to the web client whose id the app passes it, so the audience is this
      // API's own client. Checking a token needs no secret.
      case 'google':
        return env.GOOGLE_CLIENT_ID === undefined
          ? null
          : {
              issuer: this.issuer(provider, 'https://accounts.google.com'),
              clientId: env.GOOGLE_CLIENT_ID,
              alsoIssuers: ['accounts.google.com'],
              nonce: false,
              revokesOnDeletion: false,
              secret: null,
            }
      // prumo:end-google
      // prumo:apple
      // Apple's sheet issues the app's token to its bundle ID, which the same key signs a client secret for, so that a
      // deletion from the app can trade the sheet's code and revoke what it yields.
      case 'apple': {
        const secret = this.appleSecret(env.APPLE_BUNDLE_ID)

        return env.APPLE_BUNDLE_ID === undefined || secret === null
          ? null
          : {
              issuer: this.issuer(provider, 'https://appleid.apple.com'),
              clientId: env.APPLE_BUNDLE_ID,
              alsoIssuers: [],
              nonce: true,
              revokesOnDeletion: true,
              secret,
            }
      }
      // prumo:end-apple
    }

    return null
  }

  // prumo:apple
  // Apple's client secret is a JWT signed with the team's .p8 key for one client, not a string it hands out.
  private appleSecret(clientId: string | undefined): (() => Promise<string>) | null {
    const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = this.env

    if (
      clientId === undefined ||
      APPLE_TEAM_ID === undefined ||
      APPLE_KEY_ID === undefined ||
      APPLE_PRIVATE_KEY === undefined
    ) {
      return null
    }

    return async () =>
      new jose.SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID })
        .setIssuer(APPLE_TEAM_ID)
        .setSubject(clientId)
        .setAudience('https://appleid.apple.com')
        .setIssuedAt()
        .setExpirationTime(Math.floor((Date.now() + SECRET_LIFETIME_MS) / 1000))
        .sign(await jose.importPKCS8(APPLE_PRIVATE_KEY.replaceAll('\\n', '\n'), 'ES256'))
  }
  // prumo:end-apple

  private redirectUri(provider: ProviderName): string {
    return `${this.env.API_URL}/api/auth/social/${provider}/callback`
  }

  private async configuration(key: string, client: Client) {
    const cached = this.configurations.get(key)

    if (cached !== undefined && cached.until > Date.now()) {
      return cached.configuration
    }

    const configuration = await oidc.discovery(
      client.issuer,
      client.clientId,
      undefined,
      client.secret === null ? oidc.None() : oidc.ClientSecretPost(await client.secret()),
      { execute: this.options.insecure === true ? [oidc.allowInsecureRequests] : [] },
    )

    // Renewed before the secret it was built with expires.
    this.configurations.set(key, {
      configuration,
      until: Date.now() + SECRET_LIFETIME_MS / 2,
    })

    return configuration
  }

  isConfigured(provider: ProviderName): boolean {
    return this.settings(provider) !== null
  }

  isNativeConfigured(provider: ProviderName): boolean {
    return this.nativeSettings(provider) !== null
  }

  async redirect(provider: ProviderName, state: string): Promise<ProviderRedirect> {
    const settings = this.settings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError('providerNotConfigured', { provider })
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

  profile(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile> {
    return this.exchange(provider, callback, false)
  }

  revoke(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile> {
    return this.exchange(provider, callback, true)
  }

  async verify(provider: ProviderName, credential: NativeCredential): Promise<ProviderProfile> {
    const settings = this.nativeSettings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError('providerNotConfiguredInApp', { provider })
    }

    try {
      const metadata = (await this.configuration(`${provider}:native`, settings)).serverMetadata()

      if (metadata.jwks_uri === undefined) {
        throw new SocialSignInFailedError()
      }

      const keys = this.keys.get(provider) ?? jose.createRemoteJWKSet(new URL(metadata.jwks_uri))

      this.keys.set(provider, keys)

      const { payload } = await jose.jwtVerify(credential.idToken, keys, {
        issuer: [metadata.issuer, ...settings.alsoIssuers],
        audience: settings.clientId,
      })

      // A token minted for another trip, or for none, was not asked for by this app.
      if (settings.nonce && (credential.nonce === null || payload.nonce !== credential.nonce)) {
        throw new SocialSignInFailedError()
      }

      return profileOf(payload, credential.name)
    } catch (error) {
      if (error instanceof DomainError) {
        throw error
      }

      throw new SocialSignInFailedError()
    }
  }

  async revokeNative(provider: ProviderName, code: string): Promise<void> {
    const settings = this.nativeSettings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError('providerNotConfiguredInApp', { provider })
    }

    if (!settings.revokesOnDeletion) {
      return
    }

    try {
      const configuration = await this.configuration(`${provider}:native`, settings)
      // The sheet's code was issued to the app with no redirect, so it is traded with nothing beside it.
      const tokens = await oidc.genericGrantRequest(configuration, 'authorization_code', { code })

      await revokeTokens(configuration, tokens)
    } catch (error) {
      if (error instanceof DomainError) {
        throw error
      }

      throw new SocialSignInFailedError()
    }
  }

  // Trades the code for tokens and reads the profile from the ID token; for a deletion, revokes them afterwards
  // where the provider asks for it.
  private async exchange(
    provider: ProviderName,
    callback: ProviderCallback,
    revoke: boolean,
  ): Promise<ProviderProfile> {
    const settings = this.settings(provider)

    if (settings === null) {
      throw new SocialSignInFailedError('providerNotConfigured', { provider })
    }

    try {
      const configuration = await this.configuration(provider, settings)
      const tokens = await oidc.authorizationCodeGrant(configuration, callback.callbackUrl, {
        expectedState: callback.state,
        expectedNonce: callback.nonce,
        idTokenExpected: true,
        ...(callback.codeVerifier !== null && { pkceCodeVerifier: callback.codeVerifier }),
      })
      // Read only after openid-client checked the ID token's signature, issuer, audience, expiry and nonce.
      const claims = tokens.claims()

      if (claims === undefined) {
        throw new SocialSignInFailedError()
      }

      const profile = profileOf(claims, callback.name)

      if (revoke && settings.revokesOnDeletion) {
        await revokeTokens(configuration, tokens)
      }

      return profile
    } catch (error) {
      if (error instanceof DomainError) {
        throw error
      }

      throw new SocialSignInFailedError()
    }
  }
}

// What a verified ID token says about the person.
function profileOf(claims: jose.JWTPayload, name: string | null): ProviderProfile {
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
    throw new SocialSignInFailedError('providerSharedNoEmail')
  }

  return {
    subject: claims.sub,
    email: claims.email,
    // Apple writes it as the string "true".
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' ? claims.name : name,
  }
}

// Apple's own documentation: without a stored token, one obtained from a fresh authorization code is revoked.
async function revokeTokens(
  configuration: oidc.Configuration,
  tokens: { refresh_token?: string; access_token: string },
): Promise<void> {
  await oidc.tokenRevocation(configuration, tokens.refresh_token ?? tokens.access_token, {
    token_type_hint: tokens.refresh_token === undefined ? 'access_token' : 'refresh_token',
  })
}
