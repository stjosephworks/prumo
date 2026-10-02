export type AccessClaims = { userId: string; sessionId: string }

export type IssuedToken = { token: string; expiresAt: Date }

// Short-lived and checked by signature alone: nothing is looked up to accept one, so nothing can revoke one.
export const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000

export interface AccessTokens {
  issue(claims: AccessClaims, expiresAt: Date): Promise<IssuedToken>
  verify(token: string): Promise<AccessClaims | null>
}

export const ACCESS_TOKENS = Symbol('AccessTokens')
