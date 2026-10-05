// Long enough to sign in and read the consent page; the code that follows is spent within a minute.
export const AUTHORIZATION_REQUEST_LIFETIME_MS = 10 * 60 * 1000
export const AUTHORIZATION_CODE_LIFETIME_MS = 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AuthorizationStatus = 'pending' | 'approved' | 'denied' | 'exchanged'

export type AuthorizationRequest = {
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  clientState: string | null
  resource: string
  // The scopes the client asked for and the user is shown, space-separated.
  scope: string
}

// One OAuth authorization, from the client's request through the user's answer to the code it is exchanged for.
export class Authorization {
  id: string
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  clientState: string | null
  resource: string
  scope: string
  status: AuthorizationStatus = 'pending'
  userId: string | null = null
  codeHash: string | null = null
  sessionId: string | null = null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date

  constructor(request: AuthorizationRequest, now: Date) {
    this.clientId = request.clientId
    this.clientName = request.clientName
    this.redirectUri = request.redirectUri
    this.codeChallenge = request.codeChallenge
    this.clientState = request.clientState
    this.resource = request.resource
    this.scope = request.scope
    this.expiresAt = new Date(now.getTime() + AUTHORIZATION_REQUEST_LIFETIME_MS)
  }

  // The code names its authorization, as a refresh token names its session.
  static parseCode(code: string): { authorizationId: string; secret: string } | null {
    const dot = code.indexOf('.')
    const authorizationId = code.slice(0, dot)
    const secret = code.slice(dot + 1)

    return dot === -1 || !UUID.test(authorizationId) || secret === ''
      ? null
      : { authorizationId, secret }
  }

  code(secret: string): string {
    return `${this.id}.${secret}`
  }

  isPending(now: Date): boolean {
    return this.status === 'pending' && this.expiresAt > now
  }

  approve(userId: string, codeHash: string, now: Date): void {
    this.status = 'approved'
    this.userId = userId
    this.codeHash = codeHash
    this.expiresAt = new Date(now.getTime() + AUTHORIZATION_CODE_LIFETIME_MS)
  }

  deny(): void {
    this.status = 'denied'
  }

  isRedeemable(now: Date): boolean {
    return this.status === 'approved' && this.expiresAt > now
  }

  exchange(sessionId: string): void {
    this.status = 'exchanged'
    this.sessionId = sessionId
  }
}
