import { inject, injectable } from 'tsyringe'
import { Session } from '@/domain/auth/entities/session.entity'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { SupersededTokenError } from '@/domain/auth/errors/superseded-token.error'
import {
  ACCESS_TOKEN_LIFETIME_MS,
  ACCESS_TOKENS,
  type AccessTokens,
} from '@/domain/auth/ports/access-tokens.port'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'
import type { SessionTokens } from '@/domain/auth/use-cases/start-session.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

@injectable()
export class RefreshSessionUseCase {
  constructor(
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(ACCESS_TOKENS) private readonly tokens: AccessTokens,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
  ) {}

  async execute(refreshToken: string): Promise<SessionTokens> {
    const parsed = Session.parseRefreshToken(refreshToken)

    if (parsed === null) {
      throw new InvalidSessionError()
    }

    const { sessionId, secret } = parsed
    const now = new Date()
    const rotated = await this.transactions.run(async () => {
      const session = await this.sessions.lockById(sessionId)

      if (session === null) {
        return 'missing' as const
      }

      const outcome = session.check(this.opaque.digest(secret), now)

      if (outcome === 'reused') {
        // An old token came back: whoever holds it is not the client that rotated it. End the session for both.
        session.revoke(now)
        await this.sessions.save(session)
      }

      if (outcome !== 'valid') {
        return outcome
      }

      const next = this.opaque.create()

      session.rotate(this.opaque.digest(next), now)
      await this.sessions.save(session)

      return { session, next }
    })

    if (rotated === 'superseded') {
      throw new SupersededTokenError()
    }

    if (typeof rotated === 'string') {
      throw new InvalidSessionError()
    }

    const { session, next } = rotated

    return {
      accessToken: await this.tokens.issue(
        { userId: session.userId, sessionId: session.id },
        new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
      ),
      refreshToken: session.refreshToken(next),
      refreshExpiresAt: session.expiresAt,
    }
  }
}
