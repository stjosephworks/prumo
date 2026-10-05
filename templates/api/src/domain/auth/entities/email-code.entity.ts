// Short enough that guessing is a race against the clock, long enough to switch to the mail app and back.
export const EMAIL_CODE_LIFETIME_MS = 15 * 60 * 1000
export const EMAIL_CODE_ATTEMPTS = 5

export type EmailCodePurpose = 'verify-email' | 'reset-password'

export type CodeOutcome = 'valid' | 'wrong' | 'expired'

// One live code per user and purpose: sending another replaces it, and the old one stops working.
export class EmailCode {
  id: string
  userId: string
  purpose: EmailCodePurpose
  codeHash: string
  attemptsLeft: number
  expiresAt: Date
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, purpose: EmailCodePurpose, codeHash: string, now: Date) {
    this.userId = userId
    this.purpose = purpose
    this.renew(codeHash, now)
  }

  renew(codeHash: string, now: Date): void {
    this.codeHash = codeHash
    this.attemptsLeft = EMAIL_CODE_ATTEMPTS
    this.expiresAt = new Date(now.getTime() + EMAIL_CODE_LIFETIME_MS)
  }

  // Five wrong guesses out of a million leave nothing to brute-force: the code dies, and a new one must be sent.
  check(codeHash: string, now: Date): CodeOutcome {
    if (this.attemptsLeft <= 0 || this.expiresAt <= now) {
      return 'expired'
    }

    if (codeHash === this.codeHash) {
      this.attemptsLeft = 0
      return 'valid'
    }

    this.attemptsLeft -= 1
    return this.attemptsLeft === 0 ? 'expired' : 'wrong'
  }
}
