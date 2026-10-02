import { hash, verify } from '@node-rs/argon2'
import type { PasswordHasher } from '@/domain/auth/ports/password-hasher.port'

// The library's defaults are Argon2id with 19 MiB, two passes and one lane: OWASP's minimum, so none is restated.
export class Argon2PasswordHasher implements PasswordHasher {
  // A real hash of nothing in particular, so an unknown email costs one verification like any other.
  private readonly decoy = hash('decoy password that nobody holds')

  hash(password: string): Promise<string> {
    return hash(password)
  }

  async verify(stored: string | undefined, password: string): Promise<boolean> {
    if (stored === undefined) {
      await verify(await this.decoy, password)
      return false
    }

    return verify(stored, password)
  }
}
