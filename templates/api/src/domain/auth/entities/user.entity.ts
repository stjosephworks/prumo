export class User {
  id: string
  email: string
  // Null for an account that only ever signed in through a provider, or whose password a provider's proof voided.
  passwordHash: string | null
  emailVerifiedAt: Date | null = null
  createdAt: Date
  updatedAt: Date

  constructor(email: string, passwordHash: string | null) {
    this.email = User.normalizeEmail(email)
    this.passwordHash = passwordHash
  }

  // One address, one account: `Ana@Example.com ` and `ana@example.com` are the same person.
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  verifyEmail(now: Date): void {
    this.emailVerifiedAt ??= now
  }

  changePassword(passwordHash: string): void {
    this.passwordHash = passwordHash
  }

  // prumo:social
  // A provider proved the address belongs to someone else than whoever chose this password.
  removePassword(): void {
    this.passwordHash = null
  }
  // prumo:end-social
}
