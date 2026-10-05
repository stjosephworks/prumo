import { inject, injectable } from 'tsyringe'
import { EmailCode, type EmailCodePurpose } from '@/domain/auth/entities/email-code.entity'
import type { User } from '@/domain/auth/entities/user.entity'
import { MAILER, type Mail, type Mailer } from '@/domain/auth/ports/mailer.port'
import { ONE_TIME_CODES, type OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import {
  EMAIL_CODE_REPOSITORY,
  type EmailCodeRepository,
} from '@/domain/auth/repositories/email-code.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

const MAILS: Record<EmailCodePurpose, (to: string, code: string) => Mail> = {
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
}

@injectable()
export class IssueEmailCodeUseCase {
  constructor(
    @inject(EMAIL_CODE_REPOSITORY) private readonly codes: EmailCodeRepository,
    @inject(ONE_TIME_CODES) private readonly oneTimeCodes: OneTimeCodes,
    @inject(MAILER) private readonly mailer: Mailer,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
  ) {}

  async execute(user: User, purpose: EmailCodePurpose): Promise<void> {
    const code = this.oneTimeCodes.create()
    const codeHash = this.oneTimeCodes.digest(code)

    await this.transactions.run(async () => {
      const now = new Date()
      const existing = await this.codes.lockFor(user.id, purpose)

      if (existing === null) {
        await this.codes.save(new EmailCode(user.id, purpose, codeHash, now))
      } else {
        existing.renew(codeHash, now)
        await this.codes.save(existing)
      }
    })

    await this.mailer.send(MAILS[purpose](user.email, code))
  }
}
