import { authFakes } from '@test/support/fakes/auth-fakes'
import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError } from '@/domain/auth/errors/invalid-credentials.error'

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' }

describe('SignInUseCase', () => {
  it('starts a session for the right password, whatever the case of the email', async () => {
    const { register, signIn, sessions } = authFakes()
    await register(ANA)

    await signIn.execute({ email: 'ANA@example.com', password: ANA.password })

    expect(sessions.rows.size).toBe(2)
  })

  it('answers a wrong password and an unknown email alike, after checking a password both times', async () => {
    const { register, signIn, hasher } = authFakes()
    await register(ANA)

    await expect(signIn.execute({ email: ANA.email, password: 'wrong' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
    await expect(
      signIn.execute({ email: 'nobody@example.com', password: ANA.password }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(hasher.verifications).toBe(2)
  })
})
