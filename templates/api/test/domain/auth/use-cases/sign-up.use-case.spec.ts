import { authFakes } from '@test/support/fakes/auth-fakes'
import { describe, expect, it } from 'vitest'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'

const ANA = { name: 'Ana', email: ' Ana@Example.com', password: 'correct-horse-battery' }

describe('SignUpUseCase', () => {
  it('creates the user and the profile together, and starts a session', async () => {
    const { signUp, users, profiles, sessions } = authFakes()

    const tokens = await signUp.execute(ANA)
    const [user] = [...users.rows.values()]

    expect(user).toMatchObject({
      email: 'ana@example.com',
      passwordHash: 'hashed:correct-horse-battery',
    })
    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({ displayName: 'Ana' })
    expect(sessions.rows.size).toBe(1)
    expect(tokens.refreshToken.startsWith(`${[...sessions.rows.keys()][0]}.`)).toBe(true)
  })

  it('refuses an email already taken, whatever its case', async () => {
    const { signUp, profiles } = authFakes()

    await signUp.execute(ANA)

    await expect(signUp.execute({ ...ANA, email: 'ana@example.COM' })).rejects.toBeInstanceOf(
      EmailTakenError,
    )
    expect(profiles.rows.size).toBe(1)
  })
})
