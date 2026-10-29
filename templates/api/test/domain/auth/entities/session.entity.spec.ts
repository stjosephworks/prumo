import { describe, expect, it } from 'vitest'
import {
  RECENT_SIGN_IN_MS,
  ROTATION_GRACE_MS,
  Session,
} from '@/domain/auth/entities/session.entity'

const NOW = new Date('2026-10-02T12:00:00Z')
const DAYS_30 = 30 * 86_400_000
const later = (ms: number) => new Date(NOW.getTime() + ms)

describe('Session', () => {
  it('accepts the current token, and after a rotation only the new one', () => {
    const session = new Session('user-1', 'first', NOW, DAYS_30)

    expect(session.check('first', NOW)).toBe('valid')

    session.rotate('second', later(1000), DAYS_30)

    expect(session.check('second', later(2000))).toBe('valid')
  })

  it('tells a second tab, a lost answer and a kept copy apart', () => {
    const session = new Session('user-1', 'first', NOW, DAYS_30)

    session.rotate('second', NOW, DAYS_30)

    expect(session.check('first', later(ROTATION_GRACE_MS - 1))).toBe('superseded')
    expect(session.check('first', later(ROTATION_GRACE_MS))).toBe('previous')
    expect(session.check('never-issued', NOW)).toBe('reused')
  })

  it('refuses every token once revoked or expired', () => {
    const revoked = new Session('user-1', 'first', NOW, DAYS_30)
    revoked.revoke(NOW)

    expect(revoked.check('first', NOW)).toBe('expired')
    expect(
      new Session('user-1', 'first', NOW, DAYS_30).check('first', later(31 * 86_400_000)),
    ).toBe('expired')
  })

  it('reads back the refresh token it writes, and nothing malformed', () => {
    const session = new Session('user-1', 'hash', NOW, DAYS_30)
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

describe('Session.isRecentSignIn', () => {
  function startedAt(
    createdAt: Date,
    grant?: { clientId: string; resource: string; scope: string },
  ) {
    const session = new Session('user-1', 'hash', createdAt, DAYS_30, grant)

    session.createdAt = createdAt
    return session
  }

  it('holds for a sign-in of moments ago, and not once the window has passed', () => {
    expect(startedAt(later(-60_000)).isRecentSignIn(NOW)).toBe(true)
    expect(startedAt(later(-RECENT_SIGN_IN_MS)).isRecentSignIn(NOW)).toBe(false)
  })

  it('never holds for a session an OAuth client obtained, however new', () => {
    const grant = {
      clientId: 'https://client.example',
      resource: 'https://api.example',
      scope: 'profile:read',
    }

    expect(startedAt(NOW, grant).isRecentSignIn(NOW)).toBe(false)
  })
})
