export interface PasswordHasher {
  hash(password: string): Promise<string>
  // Without a hash it still spends the time of a real check and answers false, so an unknown email and a wrong
  // password take as long as each other.
  verify(hash: string | undefined, password: string): Promise<boolean>
}

export const PASSWORD_HASHER = Symbol('PasswordHasher')
