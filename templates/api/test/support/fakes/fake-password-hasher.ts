import type { PasswordHasher } from '@/domain/auth/ports/password-hasher.port'

// Reversible on purpose, so a test can read what was stored. Argon2 itself is proved in its adapter's test.
export class FakePasswordHasher implements PasswordHasher {
  verifications = 0

  async hash(password: string): Promise<string> {
    return `hashed:${password}`
  }

  async verify(hash: string | undefined, password: string): Promise<boolean> {
    this.verifications += 1
    return hash === `hashed:${password}`
  }
}
