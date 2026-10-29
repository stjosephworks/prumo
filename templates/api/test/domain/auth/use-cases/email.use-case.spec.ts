import { authFakes } from '@test/support/fakes/auth-fakes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CODE_ATTEMPTS,
  SEND_INTERVAL_MS,
  SENDS_PER_HOUR,
} from '@/domain/auth/entities/one-time-code.entity'
import { EmailNotVerifiedError } from '@/domain/auth/errors/email-not-verified.error'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { TooManyCodesError } from '@/domain/auth/errors/too-many-codes.error'

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' }

// The limits are counted in time, so each test owns the clock.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function wait(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms))
}

describe('email verification', () => {
  it('refuses to sign in an unconfirmed account, and lets it in once confirmed', async () => {
    const { signUp, signIn, verifyEmail, mailer } = authFakes()
    await signUp.execute(ANA)

    await expect(signIn.execute(ANA)).rejects.toBeInstanceOf(EmailNotVerifiedError)

    await verifyEmail.execute({ email: ANA.email, code: mailer.lastCode(ANA.email) })

    await expect(signIn.execute(ANA)).resolves.toBeDefined()
  })

  it('kills a code after five wrong guesses, even if the right one comes next', async () => {
    const { signUp, verifyEmail, mailer } = authFakes()
    await signUp.execute(ANA)
    const code = mailer.lastCode(ANA.email)

    for (let i = 0; i < CODE_ATTEMPTS; i += 1) {
      await expect(
        verifyEmail.execute({ email: ANA.email, code: '000000' }),
      ).rejects.toBeInstanceOf(InvalidCodeError)
    }

    await expect(verifyEmail.execute({ email: ANA.email, code })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
  })

  it('answers an unknown email as it answers a wrong code', async () => {
    const { verifyEmail } = authFakes()

    await expect(
      verifyEmail.execute({ email: 'nobody@example.com', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })
})

describe('password reset', () => {
  it('sets the new password, ends every old session, and confirms the email it reached', async () => {
    const { register, signIn, sessions, users, requestPasswordReset, resetPassword, mailer } =
      authFakes()
    await register(ANA)
    await signIn.execute(ANA)

    await requestPasswordReset.execute(ANA.email)
    await resetPassword.execute({
      email: ANA.email,
      code: mailer.lastCode(ANA.email),
      password: 'another-good-password',
    })

    const revoked = [...sessions.rows.values()].filter((session) => session.revokedAt !== null)
    const [user] = [...users.rows.values()]

    expect(revoked).toHaveLength(2)
    expect(user?.passwordHash).toBe('hashed:another-good-password')
    await expect(signIn.execute(ANA)).rejects.toThrow()
  })

  it('sends nothing for an unknown email, and says nothing about it either', async () => {
    const { requestPasswordReset, mailer } = authFakes()

    await expect(requestPasswordReset.execute('nobody@example.com')).resolves.toBeUndefined()
    expect(mailer.sent).toEqual([])
  })

  it('voids the previous code when a new one is sent', async () => {
    const { register, requestPasswordReset, resetPassword, mailer } = authFakes()
    await register(ANA)

    await requestPasswordReset.execute(ANA.email)
    const first = mailer.lastCode(ANA.email)
    wait(SEND_INTERVAL_MS)
    await requestPasswordReset.execute(ANA.email)

    await expect(
      resetPassword.execute({ email: ANA.email, code: first, password: 'another-good-password' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })
})

describe('sending limits', () => {
  it('sends one code a minute to an address, and says when the next may go', async () => {
    const { register, requestPasswordReset } = authFakes()
    await register(ANA)
    await requestPasswordReset.execute(ANA.email)
    wait(20_000)

    const refused = await requestPasswordReset.execute(ANA.email).catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(TooManyCodesError)
    expect((refused as TooManyCodesError).retryAfter).toBe(40)
    wait(40_000)
    await expect(requestPasswordReset.execute(ANA.email)).resolves.toBeUndefined()
  })

  it('limits an address with no account exactly as one with an account, so it tells nothing', async () => {
    const { requestPasswordReset, mailer } = authFakes()
    await requestPasswordReset.execute('nobody@example.com')

    await expect(requestPasswordReset.execute('nobody@example.com')).rejects.toBeInstanceOf(
      TooManyCodesError,
    )
    expect(mailer.sent).toEqual([])
  })

  it('sends at most five codes an hour, then waits for the hour to end', async () => {
    const { register, requestPasswordReset } = authFakes()
    await register(ANA)
    wait(SEND_INTERVAL_MS)

    for (let i = 0; i < SENDS_PER_HOUR; i += 1) {
      await requestPasswordReset.execute(ANA.email)
      wait(SEND_INTERVAL_MS)
    }

    await expect(requestPasswordReset.execute(ANA.email)).rejects.toBeInstanceOf(TooManyCodesError)
    wait(60 * 60 * 1000)
    await expect(requestPasswordReset.execute(ANA.email)).resolves.toBeUndefined()
  })

  it('forgets an address once its code is dead and its day is over', async () => {
    const { requestPasswordReset, codes } = authFakes()
    await requestPasswordReset.execute('nobody@example.com')
    wait(24 * 60 * 60 * 1000 + 1)

    await requestPasswordReset.execute('someone@example.com')

    expect([...codes.rows.values()].map((code) => code.destination)).toEqual([
      'someone@example.com',
    ])
  })
})
