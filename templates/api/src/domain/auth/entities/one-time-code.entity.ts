// Short enough that guessing is a race against the clock, long enough to switch to the mail app and back.
export const CODE_LIFETIME_MS = 15 * 60 * 1000
export const CODE_ATTEMPTS = 5

// How often one destination may be sent a code, whoever asks: a mailbox is not bombed, and a text costs money.
export const SEND_INTERVAL_MS = 60 * 1000
export const SENDS_PER_HOUR = 5
export const TEXTS_PER_DAY = 10

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export type CodeChannel = 'email' | 'phone'

// biome-ignore format: one member a line, so cutting a feature cuts its own
export type CodePurpose =
  | 'verify-email' // prumo:email
  | 'reset-password' // prumo:email
  | 'sign-in' // prumo:code-sign-in
  | 'change-email' // prumo:mail
  | 'change-phone' // prumo:sms

export type CodeOutcome = 'valid' | 'wrong' | 'expired'

// One live code per destination and purpose: sending another replaces it, and the old one stops working. The row
// exists for an address with no account too, so the limits answer alike whoever owns it.
export class OneTimeCode {
  id: string
  channel: CodeChannel
  // A normalised email, or a phone in E.164.
  destination: string
  purpose: CodePurpose
  // The account a code changes an address of; null for a code that proves an address on its own.
  userId: string | null = null
  codeHash: string
  attemptsLeft: number
  expiresAt: Date
  lastSentAt: Date
  hourStartedAt: Date
  sentThisHour = 0
  dayStartedAt: Date
  sentToday = 0
  createdAt: Date
  updatedAt: Date

  constructor(
    channel: CodeChannel,
    destination: string,
    purpose: CodePurpose,
    codeHash: string,
    now: Date,
  ) {
    this.channel = channel
    this.destination = destination
    this.purpose = purpose
    this.hourStartedAt = now
    this.dayStartedAt = now
    this.issue(codeHash, now)
  }

  // When the next code may go to this destination: `now` when it already may.
  nextSendAt(now: Date): Date {
    const limits = [new Date(this.lastSentAt.getTime() + SEND_INTERVAL_MS)]

    if (
      this.sentThisHour >= SENDS_PER_HOUR &&
      now.getTime() < this.hourStartedAt.getTime() + HOUR_MS
    ) {
      limits.push(new Date(this.hourStartedAt.getTime() + HOUR_MS))
    }

    if (
      this.channel === 'phone' &&
      this.sentToday >= TEXTS_PER_DAY &&
      now.getTime() < this.dayStartedAt.getTime() + DAY_MS
    ) {
      limits.push(new Date(this.dayStartedAt.getTime() + DAY_MS))
    }

    const latest = Math.max(now.getTime(), ...limits.map((limit) => limit.getTime()))

    return new Date(latest)
  }

  // A new code, counted against the limits. The caller checked `nextSendAt` first.
  issue(codeHash: string, now: Date): void {
    if (now.getTime() >= this.hourStartedAt.getTime() + HOUR_MS) {
      this.hourStartedAt = now
      this.sentThisHour = 0
    }

    if (now.getTime() >= this.dayStartedAt.getTime() + DAY_MS) {
      this.dayStartedAt = now
      this.sentToday = 0
    }

    this.codeHash = codeHash
    this.attemptsLeft = CODE_ATTEMPTS
    this.expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS)
    this.lastSentAt = now
    this.sentThisHour += 1
    this.sentToday += 1
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

// A row nothing can use and no limit still reads: its code is dead and its day is over.
export function staleBefore(now: Date): Date {
  return new Date(now.getTime() - DAY_MS)
}
