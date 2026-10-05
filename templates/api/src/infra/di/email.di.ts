import type { DependencyContainer } from 'tsyringe'
import { MAILER } from '@/domain/auth/ports/mailer.port'
import { ONE_TIME_CODES } from '@/domain/auth/ports/one-time-codes.port'
import { EMAIL_CODE_REPOSITORY } from '@/domain/auth/repositories/email-code.repository'
import { ENV, type Env } from '@/infra/config/env'
import { MikroOrmEmailCodeRepository } from '@/infra/database/mikroorm/repositories/mikroorm-email-code.repository'
import { HmacOneTimeCodes } from '@/infra/email/hmac-one-time-codes.adapter'
import { LogMailer } from '@/infra/email/log-mailer.adapter'

export function registerEmail(container: DependencyContainer): void {
  const env = container.resolve<Env>(ENV)

  container.register(EMAIL_CODE_REPOSITORY, { useClass: MikroOrmEmailCodeRepository })
  container.register(ONE_TIME_CODES, { useValue: new HmacOneTimeCodes(env) })
  // Silent under test, where a test registers its own Mailer to read what was sent.
  container.register(MAILER, {
    useValue: new LogMailer((line) => {
      if (env.NODE_ENV !== 'test') {
        console.info(line)
      }
    }),
  })
}
