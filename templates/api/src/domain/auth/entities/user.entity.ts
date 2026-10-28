export class User {
  id: string
  email: string
  // prumo:password
  // Null for an account that never chose one: created by a provider or a code, or voided by someone proving the inbox.
  passwordHash: string | null = null
  // prumo:end-password
  emailVerifiedAt: Date | null = null
  createdAt: Date
  updatedAt: Date

  constructor(email: string) {
    this.email = User.normalizeEmail(email)
  }

  // One address, one account: `Ana@Example.com ` and `ana@example.com` are the same person.
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  verifyEmail(now: Date): void {
    this.emailVerifiedAt ??= now
  }

  // Someone other than the account's creator proved the inbox is theirs: a provider said so, or a code sent there
  // came back. An account nobody had confirmed belongs to them, not to whoever registered the address first. True
  // when it was unconfirmed, so the caller ends every session that may not be theirs.
  proveEmail(now: Date): boolean {
    if (this.emailVerifiedAt !== null) {
      return false
    }

    this.passwordHash = null // prumo:password
    this.emailVerifiedAt = now
    return true
  }

  // prumo:password
  changePassword(passwordHash: string): void {
    this.passwordHash = passwordHash
  }
  // prumo:end-password
}
