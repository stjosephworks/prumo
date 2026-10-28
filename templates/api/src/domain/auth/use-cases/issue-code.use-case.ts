import { inject, injectable } from 'tsyringe'
import {
  type CodeChannel,
  type CodePurpose,
  OneTimeCode,
} from '@/domain/auth/entities/one-time-code.entity'
import { TooManyCodesError } from '@/domain/auth/errors/too-many-codes.error'
import { MAILER, type Mail, type Mailer } from '@/domain/auth/ports/mailer.port' // prumo:mail
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
// prumo:sms
import {
  TEXT_MESSAGES,
  type TextMessage,
  type TextMessages,
} from '@/domain/auth/ports/text-messages.port'
// prumo:end-sms
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

// Enough that the table keeps up with what it receives, few enough that no request waits on it.
const SWEEP_LIMIT = 100

// Where a code goes: an address of the channel's kind, already normalised.
export type CodeTarget = { channel: CodeChannel; destination: string }

// prumo:mail
const MAILS: Partial<Record<CodePurpose, (to: string, code: string) => Mail>> = {
  // prumo:email
  'verify-email': (to, code) => ({
    to,
    subject: `${code} is your verification code`,
    text: `Enter ${code} to confirm this email address. The code expires in 15 minutes.`,
  }),
  'reset-password': (to, code) => ({
    to,
    subject: `${code} is your password reset code`,
    text: `Enter ${code} to choose a new password. The code expires in 15 minutes. If you did not ask for it, ignore this email: your password stays as it is.`,
  }),
  // prumo:end-email
  // prumo:email-code
  'sign-in': (to, code) => ({
    to,
    subject: `${code} is your sign-in code`,
    text: `Enter ${code} to sign in. The code expires in 15 minutes. If you did not ask for it, ignore this email: nobody can sign in without it.`,
  }),
  // prumo:end-email-code
}

// prumo:end-mail
// prumo:sms
// Plain text: a line naming the web's domain would bind the code to it, and the app could no longer fill it in.
const TEXTS: Partial<Record<CodePurpose, (to: string, code: string) => TextMessage>> = {
  'sign-in': (to, code) => ({
    to,
    text: `${code} is your sign-in code. It expires in 15 minutes. Never share it.`,
  }),
}

// prumo:end-sms
@injectable()
export class IssueCodeUseCase {
  constructor(
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @inject(MAILER) private readonly mailer: Mailer, // prumo:mail
    @inject(TEXT_MESSAGES) private readonly texts: TextMessages, // prumo:sms
  ) {}

  // Writes the destination's code whether or not it is sent, so the limits answer alike for an address with an
  // account and one without. `deliver` is false when nobody there may receive it.
  async execute(
    { channel, destination }: CodeTarget,
    purpose: CodePurpose,
    { deliver }: { deliver: boolean },
  ): Promise<void> {
    const code = this.oneTimeCodes.create()
    const codeHash = this.oneTimeCodes.digest(code)

    await this.transactions.run(async () => {
      const now = new Date()

      await this.codes.sweep(now, SWEEP_LIMIT)

      const existing = await this.codes.lockFor(channel, destination, purpose)

      if (existing === null) {
        await this.codes.save(new OneTimeCode(channel, destination, purpose, codeHash, now))
        return
      }

      const nextSendAt = existing.nextSendAt(now)

      if (nextSendAt > now) {
        throw new TooManyCodesError(Math.ceil((nextSendAt.getTime() - now.getTime()) / 1000))
      }

      existing.issue(codeHash, now)
      await this.codes.save(existing)
    })

    if (!deliver) {
      return
    }

    // prumo:mail
    const mail = channel === 'email' ? MAILS[purpose] : undefined

    if (mail !== undefined) {
      await this.mailer.send(mail(destination, code))
    }

    // prumo:end-mail
    // prumo:sms
    const text = channel === 'phone' ? TEXTS[purpose] : undefined

    if (text !== undefined) {
      await this.texts.send(text(destination, code))
    }
    // prumo:end-sms
  }
}
