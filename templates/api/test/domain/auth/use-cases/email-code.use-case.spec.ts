import { authFakes } from '@test/support/fakes/auth-fakes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CODE_ATTEMPTS, SEND_INTERVAL_MS } from '@/domain/auth/entities/one-time-code.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'

const EMAIL = 'ana@example.com'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('signing in with an email code', () => {
  it('creates a confirmed account with its profile when the first code comes back', async () => {
    const { requestSignInCode, signInWithCode, users, profiles, mailer } = authFakes()

    await requestSignInCode.execute(' Ana@Example.com')
    const tokens = await signInWithCode.execute({
      email: EMAIL,
      code: mailer.lastCode(EMAIL),
      locale: 'pt',
      timezone: 'America/Sao_Paulo',
    })
    const [user] = [...users.rows.values()]

    expect(tokens.accessToken).toBeDefined()
    expect(user).toMatchObject({ email: EMAIL })
    expect(user?.emailVerifiedAt).not.toBeNull()
    expect(user?.passwordHash).toBeNull() // prumo:password
    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({
      displayName: 'ana',
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    })
  })

  it('creates nothing when a code is only sent', async () => {
    const { requestSignInCode, users } = authFakes()

    await requestSignInCode.execute(EMAIL)

    expect(users.rows.size).toBe(0)
  })

  it('signs the same account in the next time', async () => {
    const { requestSignInCode, signInWithCode, users, mailer } = authFakes()

    await requestSignInCode.execute(EMAIL)
    await signInWithCode.execute({ email: EMAIL, code: mailer.lastCode(EMAIL) })
    vi.setSystemTime(new Date(Date.now() + SEND_INTERVAL_MS))
    await requestSignInCode.execute(EMAIL)
    await signInWithCode.execute({ email: EMAIL, code: mailer.lastCode(EMAIL) })

    expect(users.rows.size).toBe(1)
  })

  it('kills a code after five wrong guesses, even if the right one comes next', async () => {
    const { requestSignInCode, signInWithCode, mailer } = authFakes()
    await requestSignInCode.execute(EMAIL)
    const code = mailer.lastCode(EMAIL)

    for (let i = 0; i < CODE_ATTEMPTS; i += 1) {
      await expect(signInWithCode.execute({ email: EMAIL, code: '000000' })).rejects.toBeInstanceOf(
        InvalidCodeError,
      )
    }

    await expect(signInWithCode.execute({ email: EMAIL, code })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
  })

  it('voids the previous code when a new one is sent', async () => {
    const { requestSignInCode, signInWithCode, mailer } = authFakes()
    await requestSignInCode.execute(EMAIL)
    const first = mailer.lastCode(EMAIL)
    vi.setSystemTime(new Date(Date.now() + SEND_INTERVAL_MS))
    await requestSignInCode.execute(EMAIL)

    await expect(signInWithCode.execute({ email: EMAIL, code: first })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
  })

  it('answers an address that was never sent a code as it answers a wrong code', async () => {
    const { signInWithCode } = authFakes()

    await expect(
      signInWithCode.execute({ email: 'nobody@example.com', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })

  it("lets a store reviewer's address in with its agreed code, once one was asked for, and reports it", async () => {
    const { requestSignInCode, signInWithCode, reviewUses } = authFakes()

    await expect(
      signInWithCode.execute({ email: 'review@example.com', code: '424242' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)

    await requestSignInCode.execute('review@example.com')

    await expect(
      signInWithCode.execute({ email: 'review@example.com', code: '424242' }),
    ).resolves.toBeDefined()
    expect(reviewUses).toEqual([expect.stringContaining('review@example.com')])
  })

  it('accepts the agreed code for no other address', async () => {
    const { requestSignInCode, signInWithCode } = authFakes()
    await requestSignInCode.execute(EMAIL)

    await expect(signInWithCode.execute({ email: EMAIL, code: '424242' })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
  })

  // prumo:password
  // The attack social sign-in closes, by code: a password account opened with someone else's address, unconfirmed.
  it('takes an unconfirmed password account from whoever chose the password', async () => {
    const { signUp, requestSignInCode, signInWithCode, users, sessions, mailer } = authFakes()
    await signUp.execute({ name: 'Squatter', email: EMAIL, password: 'correct-horse-battery' })
    for (const user of users.rows.values()) {
      user.emailVerifiedAt = null
    }
    vi.setSystemTime(new Date(Date.now() + SEND_INTERVAL_MS))

    await requestSignInCode.execute(EMAIL)
    await signInWithCode.execute({ email: EMAIL, code: mailer.lastCode(EMAIL) })
    const [user] = [...users.rows.values()]

    expect(user?.passwordHash).toBeNull()
    expect(user?.emailVerifiedAt).not.toBeNull()
    expect(
      [...sessions.rows.values()].filter((session) => session.revokedAt === null),
    ).toHaveLength(1)
  })
  // prumo:end-password
})
