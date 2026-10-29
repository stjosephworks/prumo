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

// What a provider's own sign-in sheet on the phone gives the app: an ID token issued to the app.
export type NativeCredential = {
  idToken: string
  // The nonce this API issued for the trip, which Apple writes into its token. Google's sheet takes none.
  nonce: string | null
  // Apple's sheet gives the name once, beside the token.
  name: string | null
}

// Google and Apple speak OpenID Connect: the adapter builds the provider's URL and, on the way back, validates the
// ID token (signature, issuer, audience, nonce) before anything here reads it.
export interface IdentityProviders {
  isConfigured(provider: ProviderName): boolean
  redirect(provider: ProviderName, state: string): Promise<ProviderRedirect>
  profile(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile>
  // The same, for a person deleting their account: the provider's authorization of this application is revoked too,
  // which Apple requires. A provider that requires nothing revokes nothing.
  revoke(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile>
  // The app's own sign-in sheet: whether the provider knows the app, and the ID token it gave, checked as the
  // provider's backend guide says: signature, issuer, the app's audience, expiry, and the nonce where one was issued.
  isNativeConfigured(provider: ProviderName): boolean
  verify(provider: ProviderName, credential: NativeCredential): Promise<ProviderProfile>
  // For deleting an account from the app: the code the sheet gave beside the token is traded, under the app's id, for
  // a token that is revoked. A provider that requires nothing revokes nothing.
  revokeNative(provider: ProviderName, code: string): Promise<void>
}

export const IDENTITY_PROVIDERS = Symbol('IdentityProviders')
