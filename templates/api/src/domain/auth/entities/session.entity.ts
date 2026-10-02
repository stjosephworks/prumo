// A refresh token is long-lived, so it rotates on every use and is kept only as a hash.
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

// Two tabs refreshing at once both present the same token. The second, arriving within this window, is told to
// retry instead of being treated as a stolen token.
export const ROTATION_GRACE_MS = 10 * 1000

export type RefreshOutcome = 'valid' | 'superseded' | 'reused' | 'expired'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class Session {
  id: string
  userId: string
  tokenHash: string
  previousTokenHash: string | null = null
  rotatedAt: Date | null = null
  expiresAt: Date
  revokedAt: Date | null = null
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, tokenHash: string, now: Date) {
    this.userId = userId
    this.tokenHash = tokenHash
    this.expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS)
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

  // A token that is neither the current one nor the one just replaced was replaced long ago: someone kept a copy.
  check(tokenHash: string, now: Date): RefreshOutcome {
    if (this.revokedAt !== null || this.expiresAt <= now) {
      return 'expired'
    }

    if (tokenHash === this.tokenHash) {
      return 'valid'
    }

    const justRotated =
      this.rotatedAt !== null && now.getTime() - this.rotatedAt.getTime() < ROTATION_GRACE_MS

    return tokenHash === this.previousTokenHash && justRotated ? 'superseded' : 'reused'
  }

  rotate(tokenHash: string, now: Date): void {
    this.previousTokenHash = this.tokenHash
    this.tokenHash = tokenHash
    this.rotatedAt = now
    this.expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS)
  }

  revoke(now: Date): void {
    this.revokedAt ??= now
  }
}
