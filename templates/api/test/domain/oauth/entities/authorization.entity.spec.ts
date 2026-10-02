import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_CODE_LIFETIME_MS,
  AUTHORIZATION_REQUEST_LIFETIME_MS,
  Authorization,
} from '@/domain/oauth/entities/authorization.entity'

const NOW = new Date('2026-10-02T12:00:00Z')
const later = (ms: number) => new Date(NOW.getTime() + ms)

const request = {
  clientId: 'https://client.example.com/client.json',
  clientName: 'Client',
  redirectUri: 'https://client.example.com/callback',
  codeChallenge: 'challenge',
  clientState: null,
  resource: 'http://localhost:3000/api/mcp',
}

describe('Authorization', () => {
  it('waits for an answer until the request expires', () => {
    const authorization = new Authorization(request, NOW)

    expect(authorization.isPending(later(AUTHORIZATION_REQUEST_LIFETIME_MS - 1))).toBe(true)
    expect(authorization.isPending(later(AUTHORIZATION_REQUEST_LIFETIME_MS))).toBe(false)
  })

  it('gives an approved code one minute, and no second exchange', () => {
    const authorization = new Authorization(request, NOW)

    authorization.approve('user-1', 'hash', NOW)

    expect(authorization.isPending(NOW)).toBe(false)
    expect(authorization.isRedeemable(later(AUTHORIZATION_CODE_LIFETIME_MS - 1))).toBe(true)
    expect(authorization.isRedeemable(later(AUTHORIZATION_CODE_LIFETIME_MS))).toBe(false)

    authorization.exchange('session-1')

    expect(authorization.isRedeemable(NOW)).toBe(false)
  })

  it('reads back the code it writes, and nothing malformed', () => {
    const authorization = new Authorization(request, NOW)
    authorization.id = '0199a7e2-0000-7000-8000-000000000000'

    expect(Authorization.parseCode(authorization.code('s3cret'))).toEqual({
      authorizationId: authorization.id,
      secret: 's3cret',
    })
    expect(Authorization.parseCode('nonsense')).toBeNull()
  })
})
