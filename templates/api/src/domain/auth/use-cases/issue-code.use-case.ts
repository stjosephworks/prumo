import { inject, injectable } from 'tsyringe'
import { type CodePurpose, OneTimeCode } from '@/domain/auth/entities/one-time-code.entity'
import { TooManyCodesError } from '@/domain/auth/errors/too-many-codes.error'
import { MAILER, type Mail, type Mailer } from '@/domain/auth/ports/mailer.port'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
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

const MAILS: Record<CodePurpose, (to: string, code: string) => Mail> = {
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

@injectable()
export class IssueCodeUseCase {
  constructor(
    @inject(ONE_TIME_CODE_REPOSITORY) private readonly codes: OneTimeCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(MAILER) private readonly mailer: Mailer,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
  ) {}

  // Writes the address's code whether or not it is sent, so the limits answer alike for an address with an account
  // and one without. `deliver` is false when nobody there may receive it.
  async execute(
    email: string,
    purpose: CodePurpose,
    { deliver }: { deliver: boolean },
  ): Promise<void> {
    const code = this.oneTimeCodes.create()
    const codeHash = this.oneTimeCodes.digest(code)

    await this.transactions.run(async () => {
      const now = new Date()

      await this.codes.sweep(now, SWEEP_LIMIT)

      const existing = await this.codes.lockFor('email', email, purpose)

      if (existing === null) {
        await this.codes.save(new OneTimeCode('email', email, purpose, codeHash, now))
        return
      }

      const nextSendAt = existing.nextSendAt(now)

      if (nextSendAt > now) {
        throw new TooManyCodesError(Math.ceil((nextSendAt.getTime() - now.getTime()) / 1000))
      }

      existing.issue(codeHash, now)
      await this.codes.save(existing)
    })

    if (deliver) {
      await this.mailer.send(MAILS[purpose](email, code))
    }
  }
}
