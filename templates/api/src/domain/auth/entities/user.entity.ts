export class User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date

  constructor(email: string, passwordHash: string) {
    this.email = User.normalizeEmail(email)
    this.passwordHash = passwordHash
  }

  // One address, one account: `Ana@Example.com ` and `ana@example.com` are the same person.
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }
}
