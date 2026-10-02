export type AccessClaims = { userId: string; sessionId: string; clientId?: string }

export type IssuedToken = { token: string; expiresAt: Date }

// Short-lived and checked by signature alone: nothing is looked up to accept one, so nothing can revoke one.
export const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000

// Without an audience a token is for this API's own routes; with one, for that resource alone. Neither is accepted
// where the other is expected.
export interface AccessTokens {
  issue(claims: AccessClaims, expiresAt: Date, audience?: string): Promise<IssuedToken>
  verify(token: string, audience?: string): Promise<AccessClaims | null>
}

export const ACCESS_TOKENS = Symbol('AccessTokens')
