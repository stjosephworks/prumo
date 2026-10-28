import { authFakes } from '@test/support/fakes/auth-fakes'
import { describe, expect, it } from 'vitest'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'

const ANA = { name: 'Ana', email: ' Ana@Example.com', password: 'correct-horse-battery' }

describe('SignUpUseCase', () => {
  it('creates the user and the profile together', async () => {
    const { signUp, users, profiles } = authFakes()

    await signUp.execute(ANA)
    const [user] = [...users.rows.values()]

    expect(user).toMatchObject({
      email: 'ana@example.com',
      passwordHash: 'hashed:correct-horse-battery',
    })
    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({ displayName: 'Ana' })
  })

  it("starts the profile in the device's language and timezone", async () => {
    const { signUp, users, profiles } = authFakes()

    await signUp.execute({ ...ANA, locale: 'pt', timezone: 'America/Sao_Paulo' })
    const [user] = [...users.rows.values()]

    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    })
  })

  it('starts in English and UTC when the device says nothing it supports', async () => {
    const { signUp, users, profiles } = authFakes()

    await signUp.execute({ ...ANA, locale: 'ja-JP' })
    const [user] = [...users.rows.values()]

    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({ locale: 'en', timezone: 'UTC' })
  })

  it('refuses an email already taken, whatever its case', async () => {
    const { signUp, profiles } = authFakes()

    await signUp.execute(ANA)

    await expect(signUp.execute({ ...ANA, email: 'ana@example.COM' })).rejects.toBeInstanceOf(
      EmailTakenError,
    )
    expect(profiles.rows.size).toBe(1)
  })

  // prumo:email
  it('sends a code and opens no session until the email is confirmed', async () => {
    const { signUp, sessions, mailer } = authFakes()

    expect(await signUp.execute(ANA)).toBeNull()
    expect(sessions.rows.size).toBe(0)
    expect(mailer.lastCode('ana@example.com')).toMatch(/^\d{6}$/)
  })
  // prumo:end-email
})
