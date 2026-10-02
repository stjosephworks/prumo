export interface AuthorizationCodes {
  create(): string
  digest(code: string): string
  // PKCE's S256: whether the verifier the client kept hashes to the challenge it sent first.
  matchesChallenge(verifier: string, challenge: string): boolean
}

export const AUTHORIZATION_CODES = Symbol('AuthorizationCodes')
