import { describe, expect, it } from 'vitest'
import { ROTATION_GRACE_MS, Session } from '@/domain/auth/entities/session.entity'

const NOW = new Date('2026-10-02T12:00:00Z')
const later = (ms: number) => new Date(NOW.getTime() + ms)

describe('Session', () => {
  it('accepts the current token, and after a rotation only the new one', () => {
    const session = new Session('user-1', 'first', NOW)

    expect(session.check('first', NOW)).toBe('valid')

    session.rotate('second', later(1000))

    expect(session.check('second', later(2000))).toBe('valid')
  })

  it('tells a token rotated a moment ago from one kept and replayed', () => {
    const session = new Session('user-1', 'first', NOW)

    session.rotate('second', NOW)

    expect(session.check('first', later(ROTATION_GRACE_MS - 1))).toBe('superseded')
    expect(session.check('first', later(ROTATION_GRACE_MS))).toBe('reused')
    expect(session.check('never-issued', NOW)).toBe('reused')
  })

  it('refuses every token once revoked or expired', () => {
    const revoked = new Session('user-1', 'first', NOW)
    revoked.revoke(NOW)

    expect(revoked.check('first', NOW)).toBe('expired')
    expect(new Session('user-1', 'first', NOW).check('first', later(31 * 86_400_000))).toBe(
      'expired',
    )
  })

  it('reads back the refresh token it writes, and nothing malformed', () => {
    const session = new Session('user-1', 'hash', NOW)
    session.id = '0199a7e2-0000-7000-8000-000000000000'

    expect(Session.parseRefreshToken(session.refreshToken('s3cret'))).toEqual({
      sessionId: session.id,
      secret: 's3cret',
    })
    for (const token of ['', 'no-dot', 'not-a-uuid.secret', `${session.id}.`]) {
      expect(Session.parseRefreshToken(token), token).toBeNull()
    }
  })
})
