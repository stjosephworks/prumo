import { describe, expect, it } from 'vitest'
import { Argon2PasswordHasher } from '@/infra/auth/argon2-password-hasher.adapter'

describe('Argon2PasswordHasher', () => {
  it('stores Argon2id with OWASP’s minimum, and verifies only the right password', async () => {
    const hasher = new Argon2PasswordHasher()
    const stored = await hasher.hash('correct-horse-battery')

    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(await hasher.verify(stored, 'correct-horse-battery')).toBe(true)
    expect(await hasher.verify(stored, 'wrong')).toBe(false)
  })

  it('answers false without a hash, after doing the same work', async () => {
    expect(await new Argon2PasswordHasher().verify(undefined, 'anything')).toBe(false)
  })
})
