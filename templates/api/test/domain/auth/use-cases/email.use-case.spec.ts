import { authFakes } from '@test/support/fakes/auth-fakes'
import { describe, expect, it } from 'vitest'
import { EMAIL_CODE_ATTEMPTS } from '@/domain/auth/entities/email-code.entity'
import { EmailNotVerifiedError } from '@/domain/auth/errors/email-not-verified.error'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' }

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

    for (let i = 0; i < EMAIL_CODE_ATTEMPTS; i += 1) {
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
    await requestPasswordReset.execute(ANA.email)

    await expect(
      resetPassword.execute({ email: ANA.email, code: first, password: 'another-good-password' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })
})
