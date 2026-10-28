// Where an account is reached: an email, or a phone in E.164.
// biome-ignore format: one member a line, so cutting a feature cuts its own
export type Address =
  | { email: string }
  | { phone: string } // prumo:phone-code

export class User {
  id: string
  // biome-ignore format: one member a line, so cutting a feature cuts its own
  email:
    | string
    | null // prumo:phone-code
  // prumo:phone-code
  // In E.164, as an SMS is addressed. An account created by an email code has none until it adds one.
  phone: string | null = null
  phoneVerifiedAt: Date | null = null
  // prumo:end-phone-code
  // prumo:password
  // Null for an account that never chose one: created by a provider or a code, or voided by someone proving the inbox.
  passwordHash: string | null = null
  // prumo:end-password
  emailVerifiedAt: Date | null = null
  createdAt: Date
  updatedAt: Date

  constructor(address: Address) {
    // prumo:phone-code
    // Reached by the phone that proved itself, and by no email until one is added.
    if ('phone' in address) {
      this.email = null
      this.phone = address.phone
      return
    }

    // prumo:end-phone-code
    this.email = User.normalizeEmail(address.email)
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

  // prumo:phone-code
  // A code sent to the phone came back. Only ever set by such a code, so nobody else can have claimed it first.
  verifyPhone(now: Date): void {
    this.phoneVerifiedAt ??= now
  }
  // prumo:end-phone-code

  // prumo:password
  changePassword(passwordHash: string): void {
    this.passwordHash = passwordHash
  }
  // prumo:end-password
}
