import { authFakes } from '@test/support/fakes/auth-fakes'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROTATION_GRACE_MS } from '@/domain/auth/entities/session.entity'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { SupersededTokenError } from '@/domain/auth/errors/superseded-token.error'

afterEach(() => {
  vi.useRealTimers()
})

describe('RefreshSessionUseCase', () => {
  it('rotates the refresh token on every use', async () => {
    const { signedIn, refresh } = authFakes()
    const first = await signedIn()

    const second = await refresh.execute(first.refreshToken)
    const third = await refresh.execute(second.refreshToken)

    expect(new Set([first.refreshToken, second.refreshToken, third.refreshToken]).size).toBe(3)
  })

  it('asks a client that lost a race to retry, and revokes nothing', async () => {
    const { signedIn, refresh, sessions } = authFakes()
    const first = await signedIn()

    const second = await refresh.execute(first.refreshToken)

    await expect(refresh.execute(first.refreshToken)).rejects.toBeInstanceOf(SupersededTokenError)
    expect([...sessions.rows.values()][0]?.revokedAt).toBeNull()
    await expect(refresh.execute(second.refreshToken)).resolves.toBeDefined()
  })

  it('ends the session when a token comes back after the grace period', async () => {
    vi.useFakeTimers()
    const { signedIn, refresh, sessions } = authFakes()
    const first = await signedIn()
    const second = await refresh.execute(first.refreshToken)

    vi.advanceTimersByTime(ROTATION_GRACE_MS)

    await expect(refresh.execute(first.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError)
    expect([...sessions.rows.values()][0]?.revokedAt).not.toBeNull()
    // The thief's replay also locked out the rightful client: that is the point.
    await expect(refresh.execute(second.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError)
  })

  it('refuses a token that names no session or is not one at all', async () => {
    const { refresh } = authFakes()

    for (const token of ['garbage', '0199a7e2-0000-7000-8000-000000000000.secret']) {
      await expect(refresh.execute(token), token).rejects.toBeInstanceOf(InvalidSessionError)
    }
  })

  it('refuses every token of a session signed out of', async () => {
    const { signedIn, signOut, refresh, sessions } = authFakes()
    const tokens = await signedIn()
    const session = [...sessions.rows.values()][0]

    await signOut.execute(session?.userId ?? '', session?.id ?? '')

    await expect(refresh.execute(tokens.refreshToken)).rejects.toBeInstanceOf(InvalidSessionError)
  })
})
