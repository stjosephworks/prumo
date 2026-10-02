import { jwtVerify, SignJWT } from 'jose'
import type {
  AccessClaims,
  AccessTokens,
  IssuedToken,
} from '@/domain/auth/ports/access-tokens.port'
import type { Env } from '@/infra/config/env'

// One algorithm, named on both sides: a token that declares any other, `none` included, is refused.
const ALGORITHM = 'HS256'

export class JoseAccessTokens implements AccessTokens {
  private readonly key: Uint8Array
  private readonly issuer: string

  constructor(env: Pick<Env, 'JWT_SECRET' | 'API_URL'>) {
    this.key = new TextEncoder().encode(env.JWT_SECRET)
    this.issuer = env.API_URL
  }

  async issue(
    { userId, sessionId, clientId }: AccessClaims,
    expiresAt: Date,
    audience = this.issuer,
  ): Promise<IssuedToken> {
    const token = await new SignJWT({
      sid: sessionId,
      ...(clientId !== undefined && { client_id: clientId }),
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key)

    return { token, expiresAt }
  }

  async verify(token: string, audience = this.issuer): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: this.issuer,
        audience,
      })

      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return null
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        ...(typeof payload.client_id === 'string' && { clientId: payload.client_id }),
      }
    } catch {
      return null
    }
  }
}
