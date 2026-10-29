import { inject, injectable } from 'tsyringe'
import {
  type CodeChannel,
  type CodePurpose,
  OneTimeCode,
} from '@/domain/auth/entities/one-time-code.entity'
import { TooManyCodesError } from '@/domain/auth/errors/too-many-codes.error'
import { MAILER, type Mailer } from '@/domain/auth/ports/mailer.port' // prumo:mail
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import { TEXT_MESSAGES, type TextMessages } from '@/domain/auth/ports/text-messages.port' // prumo:sms
import {
  ONE_TIME_CODE_REPOSITORY,
  type OneTimeCodeRepository,
} from '@/domain/auth/repositories/one-time-code.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'
import { format, type Locale } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// Enough that the table keeps up with what it receives, few enough that no request waits on it.
const SWEEP_LIMIT = 100

// Where a code goes: an address of the channel's kind, already normalised.
export type CodeTarget = { channel: CodeChannel; destination: string }

// prumo:mail
// Which of the messages' mails each purpose sends.
const MAILS: Partial<
  Record<CodePurpose, (messages: Messages) => { subject: string; text: string }>
> = {
  // prumo:email
  'verify-email': (messages) => messages.mail.verifyEmail,
  'reset-password': (messages) => messages.mail.resetPassword,
  // prumo:end-email
  'sign-in': (messages) => messages.mail.signIn, // prumo:email-code
  'change-email': (messages) => messages.mail.changeEmail,
}

// prumo:end-mail
// prumo:sms
// Plain text: a line naming the web's domain would bind the code to it, and the app could no longer fill it in.
const TEXTS: Partial<Record<CodePurpose, (messages: Messages) => string>> = {
  'sign-in': (messages) => messages.texts.signIn,
  'change-phone': (messages) => messages.texts.changePhone,
}

// prumo:end-sms
@injectable()
export class IssueCodeUseCase {
  constructor(
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @inject(MAILER) private readonly mailer: Mailer, // prumo:mail
    @inject(TEXT_MESSAGES) private readonly texts: TextMessages, // prumo:sms
  ) {}

  // Writes the destination's code whether or not it is sent, so the limits answer alike for an address with an
  // account and one without. `deliver` is false when nobody there may receive it; `userId` binds a code that changes
  // an account's address to that account. It is written in the language of `account`'s profile, which is read
  // wherever its owner reads mail, else in `locale`, the one the request asked in.
  async execute(
    { channel, destination }: CodeTarget,
    purpose: CodePurpose,
    {
      deliver,
      userId = null,
      account = userId,
      locale,
    }: { deliver: boolean; userId?: string | null; account?: string | null; locale: Locale },
  ): Promise<void> {
    const code = this.oneTimeCodes.create()
    const codeHash = this.oneTimeCodes.digest(code)

    await this.transactions.run(async () => {
      const now = new Date()

      await this.codes.sweep(now, SWEEP_LIMIT)

      const existing = await this.codes.lockFor(channel, destination, purpose)

      if (existing === null) {
        const created = new OneTimeCode(channel, destination, purpose, codeHash, now)

        created.userId = userId
        await this.codes.save(created)
        return
      }

      const nextSendAt = existing.nextSendAt(now)

      if (nextSendAt > now) {
        throw new TooManyCodesError(Math.ceil((nextSendAt.getTime() - now.getTime()) / 1000))
      }

      existing.issue(codeHash, now)
      existing.userId = userId
      await this.codes.save(existing)
    })

    if (!deliver) {
      return
    }

    const profile = account === null ? null : await this.profiles.findByUserId(account)
    const messages = messagesFor(profile?.locale ?? locale)

    // prumo:mail
    const mail = channel === 'email' ? MAILS[purpose]?.(messages) : undefined

    if (mail !== undefined) {
      await this.mailer.send({
        to: destination,
        subject: format(mail.subject, { code }),
        text: format(mail.text, { code }),
      })
    }

    // prumo:end-mail
    // prumo:sms
    const text = channel === 'phone' ? TEXTS[purpose]?.(messages) : undefined

    if (text !== undefined) {
      await this.texts.send({ to: destination, text: format(text, { code }) })
    }
    // prumo:end-sms
  }
}
