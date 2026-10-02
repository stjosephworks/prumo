export type ProviderName = 'google' | 'apple'

export type ProviderProfile = {
  subject: string
  email: string
  emailVerified: boolean
  name: string | null
}

export type ProviderRedirect = { url: string; codeVerifier: string | null; nonce: string }

export type ProviderCallback = {
  callbackUrl: URL
  state: string
  codeVerifier: string | null
  nonce: string
  // Apple sends the user's name once, beside the code, and never inside the ID token.
  name: string | null
}

// Google and Apple speak OpenID Connect: the adapter builds the provider's URL and, on the way back, validates the
// ID token (signature, issuer, audience, nonce) before anything here reads it.
export interface IdentityProviders {
  isConfigured(provider: ProviderName): boolean
  redirect(provider: ProviderName, state: string): Promise<ProviderRedirect>
  profile(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile>
}

export const IDENTITY_PROVIDERS = Symbol('IdentityProviders')
