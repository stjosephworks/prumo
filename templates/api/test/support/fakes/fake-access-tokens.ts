import type {
  AccessClaims,
  AccessTokens,
  IssuedToken,
} from '@/domain/auth/ports/access-tokens.port'

export class FakeAccessTokens implements AccessTokens {
  async issue({ userId, sessionId }: AccessClaims, expiresAt: Date): Promise<IssuedToken> {
    return { token: `access:${userId}:${sessionId}`, expiresAt }
  }

  async verify(token: string): Promise<AccessClaims | null> {
    const [kind, userId, sessionId] = token.split(':')

    return kind === 'access' && userId !== undefined && sessionId !== undefined
      ? { userId, sessionId }
      : null
  }
}
