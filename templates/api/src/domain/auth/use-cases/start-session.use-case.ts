import { inject, injectable } from 'tsyringe'
import { Session } from '@/domain/auth/entities/session.entity'
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
  accessToken: IssuedToken
  refreshToken: string
  refreshExpiresAt: Date
}

@injectable()
export class StartSessionUseCase {
  constructor(
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(ACCESS_TOKENS) private readonly tokens: AccessTokens,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
  ) {}

  async execute(userId: string): Promise<SessionTokens> {
    const now = new Date()
    const secret = this.opaque.create()
    const session = new Session(userId, this.opaque.digest(secret), now)

    await this.sessions.save(session)

    return {
      accessToken: await this.tokens.issue(
        { userId, sessionId: session.id },
        new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
      ),
      refreshToken: session.refreshToken(secret),
      refreshExpiresAt: session.expiresAt,
    }
  }
}
