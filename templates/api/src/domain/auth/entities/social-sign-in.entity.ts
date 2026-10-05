import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'

// Long enough to sign in at the provider; the code a mobile app exchanges afterwards is spent within two minutes.
export const SOCIAL_SIGN_IN_LIFETIME_MS = 10 * 60 * 1000
export const SOCIAL_EXCHANGE_LIFETIME_MS = 2 * 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SocialClient = 'web' | 'mobile'

export type SocialSignInStatus = 'started' | 'signed-in' | 'exchanged'

// One trip to a provider and back. Its id travels as OAuth's state; the browser that started it holds a secret the
// callback must present, so a callback carrying someone else's code cannot sign this browser into their account.
export class SocialSignIn {
  id: string
  provider: ProviderName
  client: SocialClient
  returnTo: string
  browserHash: string
  codeVerifier: string | null = null
  nonce = ''
  status: SocialSignInStatus = 'started'
  userId: string | null = null
  exchangeHash: string | null = null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date

  constructor(
    provider: ProviderName,
    client: SocialClient,
    returnTo: string,
    browserHash: string,
    now: Date,
  ) {
    this.provider = provider
    this.client = client
    this.returnTo = returnTo
    this.browserHash = browserHash
    this.expiresAt = new Date(now.getTime() + SOCIAL_SIGN_IN_LIFETIME_MS)
  }

  // `<id>.<secret>`, as refresh tokens and authorization codes are written.
  static parseToken(token: string): { id: string; secret: string } | null {
    const dot = token.indexOf('.')
    const id = token.slice(0, dot)
    const secret = token.slice(dot + 1)

    return dot === -1 || !UUID.test(id) || secret === '' ? null : { id, secret }
  }

  token(secret: string): string {
    return `${this.id}.${secret}`
  }

  // What the provider's redirect requires back: the PKCE verifier, when the provider takes PKCE, and the nonce.
  prepare(codeVerifier: string | null, nonce: string): void {
    this.codeVerifier = codeVerifier
    this.nonce = nonce
  }

  isStarted(now: Date): boolean {
    return this.status === 'started' && this.expiresAt > now
  }

  // The web is signed in at once; a mobile app gets a code to exchange, so its tokens never travel in a URL.
  signIn(userId: string, exchangeHash: string | null, now: Date): void {
    this.status = 'signed-in'
    this.userId = userId
    this.exchangeHash = exchangeHash
    this.expiresAt = new Date(now.getTime() + SOCIAL_EXCHANGE_LIFETIME_MS)
  }

  isExchangeable(now: Date): boolean {
    return this.status === 'signed-in' && this.exchangeHash !== null && this.expiresAt > now
  }

  exchange(): void {
    this.status = 'exchanged'
  }
}
