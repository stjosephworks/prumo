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
// prumo:multi-language
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '@/domain/users/repositories/profile.repository'
// prumo:end-multi-language
import { format, type Locale } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// Enough that the table keeps up with what it receives, few enough that no request waits on it.
const SWEEP_LIMIT = 100

// Where a code goes: an address of the channel's kind, already normalised.
export type CodeTarget = { channel: CodeChannel; destination: string }

// prumo:mail
// prumo:multi-language
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
// prumo:end-multi-language
// prumo:single-language
// // The mail each purpose sends, around its code.
// const MAILS: Partial<Record<CodePurpose, (code: string) => { subject: string; text: string }>> = {
// prumo:email
//   'verify-email': (code) => ({
//     subject: format(messages.mail.verifyEmail.subject, { code }),
//     text: format(messages.mail.verifyEmail.text, { code }),
//   }),
//   'reset-password': (code) => ({
//     subject: format(messages.mail.resetPassword.subject, { code }),
//     text: format(messages.mail.resetPassword.text, { code }),
//   }),
// prumo:end-email
// prumo:email-code
//   'sign-in': (code) => ({
//     subject: format(messages.mail.signIn.subject, { code }),
//     text: format(messages.mail.signIn.text, { code }),
//   }),
// prumo:end-email-code
//   'change-email': (code) => ({
//     subject: format(messages.mail.changeEmail.subject, { code }),
//     text: format(messages.mail.changeEmail.text, { code }),
//   }),
// }
// prumo:end-single-language

// prumo:end-mail
// prumo:sms
// Plain text: a line naming the web's domain would bind the code to it, and the app could no longer fill it in.
// prumo:multi-language
const TEXTS: Partial<Record<CodePurpose, (messages: Messages) => string>> = {
  'sign-in': (messages) => messages.texts.signIn,
  'change-phone': (messages) => messages.texts.changePhone,
}
// prumo:end-multi-language
// prumo:single-language
// const TEXTS: Partial<Record<CodePurpose, (code: string) => string>> = {
//   'sign-in': (code) => format(messages.texts.signIn, { code }),
//   'change-phone': (code) => format(messages.texts.changePhone, { code }),
// }
// prumo:end-single-language

// prumo:end-sms
@injectable()
export class IssueCodeUseCase {
  constructor(
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository, // prumo:multi-language
    @inject(MAILER) private readonly mailer: Mailer, // prumo:mail
    @inject(TEXT_MESSAGES) private readonly texts: TextMessages, // prumo:sms
  ) {}

  // Writes the destination's code whether or not it is sent, so the limits answer alike for an address with an
  // account and one without. `deliver` is false when nobody there may receive it; `userId` binds a code that changes
  // an account's address to that account.
  // prumo:multi-language
  // It is written in the language of `account`'s profile, which is read wherever its owner reads mail, else in
  // `locale`, the one the request asked in.
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
    // prumo:end-multi-language
    // prumo:single-language
    // async execute(
    //   { channel, destination }: CodeTarget,
    //   purpose: CodePurpose,
    //   { deliver, userId = null }: { deliver: boolean; userId?: string | null },
    // ): Promise<void> {
    // prumo:end-single-language
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

    // prumo:multi-language
    const profile = account === null ? null : await this.profiles.findByUserId(account)
    const messages = messagesFor(profile?.locale ?? locale)

    // prumo:end-multi-language
    // prumo:mail
    // prumo:multi-language
    const mail = channel === 'email' ? MAILS[purpose]?.(messages) : undefined

    if (mail !== undefined) {
      await this.mailer.send({
        to: destination,
        subject: format(mail.subject, { code }),
        text: format(mail.text, { code }),
      })
    }
    // prumo:end-multi-language
    // prumo:single-language
    // const mail = channel === 'email' ? MAILS[purpose]?.(code) : undefined
    //
    // if (mail !== undefined) {
    //   await this.mailer.send({ to: destination, ...mail })
    // }
    // prumo:end-single-language

    // prumo:end-mail
    // prumo:sms
    // prumo:multi-language
    const text = channel === 'phone' ? TEXTS[purpose]?.(messages) : undefined

    if (text !== undefined) {
      await this.texts.send({ to: destination, text: format(text, { code }) })
    }
    // prumo:end-multi-language
    // prumo:single-language
    // const text = channel === 'phone' ? TEXTS[purpose]?.(code) : undefined
    //
    // if (text !== undefined) {
    //   await this.texts.send({ to: destination, text })
    // }
    // prumo:end-single-language
    // prumo:end-sms
  }
}
