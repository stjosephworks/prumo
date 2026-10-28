// How long a session lives past its last refresh, in milliseconds: the product's to choose, from
// SESSION_LIFETIME_DAYS. A refresh token is long-lived, so it rotates on every use and is kept only as a hash.
export const SESSION_LIFETIME = Symbol('SessionLifetime')

// Two tabs refreshing at once both present the same token. The second, arriving within this window, is told to
// retry instead of being treated as a stolen token.
export const ROTATION_GRACE_MS = 10 * 1000

// How long after signing in a person may still change what signs them in: long enough to finish what they came
// for, short enough that a session taken later cannot.
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000

export type RefreshOutcome = 'valid' | 'previous' | 'superseded' | 'reused' | 'expired'

// A session the user started in this application has none of these. One an OAuth client obtained names the client,
// the resource its access tokens are for, and the scopes the user granted it, space-separated as OAuth writes them.
export type Grant = { clientId: string; resource: string; scope: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class Session {
  id: string
  userId: string
  tokenHash: string
  clientId: string | null = null
  resource: string | null = null
  scope: string | null = null
  previousTokenHash: string | null = null
  rotatedAt: Date | null = null
  expiresAt: Date
  revokedAt: Date | null = null
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, tokenHash: string, now: Date, lifetimeMs: number, grant?: Grant) {
    this.userId = userId
    this.tokenHash = tokenHash
    this.clientId = grant?.clientId ?? null
    this.resource = grant?.resource ?? null
    this.scope = grant?.scope ?? null
    this.expiresAt = new Date(now.getTime() + lifetimeMs)
  }

  // Signed into in this application moments ago. A session an OAuth client obtained never is: it acts for the
  // person, and cannot change how they sign in.
  isRecentSignIn(now: Date): boolean {
    return this.clientId === null && now.getTime() - this.createdAt.getTime() < RECENT_SIGN_IN_MS
  }

  // The refresh token names its session, so a token from any earlier rotation is recognised as reuse.
  static parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    const dot = token.indexOf('.')
    const sessionId = token.slice(0, dot)
    const secret = token.slice(dot + 1)

    return dot === -1 || !UUID.test(sessionId) || secret === '' ? null : { sessionId, secret }
  }

  refreshToken(secret: string): string {
    return `${this.id}.${secret}`
  }

  // The previous token, moments after its rotation, is a second tab: it retries. Later it is a client whose answer
  // never arrived, killed or offline mid-refresh, since the current token has not been presented: it is let back
  // in. Any other token was replaced before that: someone kept a copy.
  check(tokenHash: string, now: Date): RefreshOutcome {
    if (this.revokedAt !== null || this.expiresAt <= now) {
      return 'expired'
    }

    if (tokenHash === this.tokenHash) {
      return 'valid'
    }

    if (tokenHash !== this.previousTokenHash) {
      return 'reused'
    }

    const justRotated =
      this.rotatedAt !== null && now.getTime() - this.rotatedAt.getTime() < ROTATION_GRACE_MS

    return justRotated ? 'superseded' : 'previous'
  }

  rotate(tokenHash: string, now: Date, lifetimeMs: number): void {
    this.previousTokenHash = this.tokenHash
    this.tokenHash = tokenHash
    this.rotatedAt = now
    this.expiresAt = new Date(now.getTime() + lifetimeMs)
  }

  // A rotation from the previous token: the current one, never delivered, is dropped, and the previous stays the
  // previous. Should the dropped one come back, it is a copy, and ends the session.
  rotateFromPrevious(tokenHash: string, now: Date, lifetimeMs: number): void {
    this.tokenHash = tokenHash
    this.rotatedAt = now
    this.expiresAt = new Date(now.getTime() + lifetimeMs)
  }

  revoke(now: Date): void {
    this.revokedAt ??= now
  }
}
