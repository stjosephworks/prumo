import { SignJWT, UnsecuredJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { JoseAccessTokens } from '@/infra/auth/jose-access-tokens.adapter'

const ENV = {
  JWT_SECRET: 'a-secret-that-is-at-least-32-characters',
  API_URL: 'http://localhost:3000',
}
const CLAIMS = { userId: '0199a7e2-0000-7000-8000-000000000001', sessionId: 'session-1' }
const inAMinute = () => new Date(Date.now() + 60_000)

describe('JoseAccessTokens', () => {
  it('reads back the claims of a token it issued', async () => {
    const tokens = new JoseAccessTokens(ENV)
    const { token } = await tokens.issue(CLAIMS, inAMinute())

    expect(await tokens.verify(token)).toEqual(CLAIMS)
  })

  it('refuses an expired token, another secret, another issuer and garbage', async () => {
    const tokens = new JoseAccessTokens(ENV)
    const expired = await tokens.issue(CLAIMS, new Date(Date.now() - 1000))
    const otherSecret = await new JoseAccessTokens({ ...ENV, JWT_SECRET: 'x'.repeat(40) }).issue(
      CLAIMS,
      inAMinute(),
    )
    const otherIssuer = await new JoseAccessTokens({ ...ENV, API_URL: 'https://elsewhere' }).issue(
      CLAIMS,
      inAMinute(),
    )

    for (const token of [expired.token, otherSecret.token, otherIssuer.token, 'not.a.jwt']) {
      expect(await tokens.verify(token)).toBeNull()
    }
  })

  it('refuses a token that names no algorithm or another one', async () => {
    const tokens = new JoseAccessTokens(ENV)
    const claims = { sid: CLAIMS.sessionId }
    const unsigned = new UnsecuredJWT(claims)
      .setSubject(CLAIMS.userId)
      .setIssuer(ENV.API_URL)
      .setAudience(ENV.API_URL)
      .setExpirationTime('1m')
      .encode()
    const hs512 = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(CLAIMS.userId)
      .setIssuer(ENV.API_URL)
      .setAudience(ENV.API_URL)
      .setExpirationTime('1m')
      .sign(new TextEncoder().encode(`${ENV.JWT_SECRET}${'-'.repeat(32)}`))

    expect(await tokens.verify(unsigned)).toBeNull()
    expect(await tokens.verify(hs512)).toBeNull()
  })
})
