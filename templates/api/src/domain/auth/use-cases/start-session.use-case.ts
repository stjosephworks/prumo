import { inject, injectable } from 'tsyringe'
import { type Grant, Session } from '@/domain/auth/entities/session.entity'
import {
  ACCESS_TOKEN_LIFETIME_MS,
  ACCESS_TOKENS,
  type AccessTokens,
  type IssuedToken,
} from '@/domain/auth/ports/access-tokens.port'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'

export type SessionTokens = {
  sessionId: string
  accessToken: IssuedToken
  refreshToken: string
  refreshExpiresAt: Date
  // What an OAuth client's tokens may do; null for the application's own sessions, which may do everything.
  scope: string | null
}

@injectable()
export class StartSessionUseCase {
  constructor(
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(ACCESS_TOKENS) private readonly tokens: AccessTokens,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
  ) {}

  async execute(userId: string, grant?: Grant): Promise<SessionTokens> {
    const now = new Date()
    const secret = this.opaque.create()
    const session = new Session(userId, this.opaque.digest(secret), now, grant)

    await this.sessions.save(session)

    return {
      sessionId: session.id,
      accessToken: await this.tokens.issue(
        {
          userId,
          sessionId: session.id,
          ...(grant && { clientId: grant.clientId, scope: grant.scope }),
        },
        new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
        grant?.resource,
      ),
      refreshToken: session.refreshToken(secret),
      refreshExpiresAt: session.expiresAt,
      scope: session.scope,
    }
  }
}
