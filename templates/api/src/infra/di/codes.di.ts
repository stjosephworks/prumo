import type { DependencyContainer } from 'tsyringe'
import { MAILER } from '@/domain/auth/ports/mailer.port' // prumo:mail
import { ONE_TIME_CODES } from '@/domain/auth/ports/one-time-codes.port'
import { ONE_TIME_CODE_REPOSITORY } from '@/domain/auth/repositories/one-time-code.repository'
import { HmacOneTimeCodes } from '@/infra/codes/hmac-one-time-codes.adapter'
import { ENV, type Env } from '@/infra/config/env'
import { MikroOrmOneTimeCodeRepository } from '@/infra/database/mikroorm/repositories/mikroorm-one-time-code.repository'
import { LogMailer } from '@/infra/email/log-mailer.adapter' // prumo:mail

export function registerCodes(container: DependencyContainer): void {
  const env = container.resolve<Env>(ENV)

  container.register(ONE_TIME_CODE_REPOSITORY, { useClass: MikroOrmOneTimeCodeRepository })
  container.register(ONE_TIME_CODES, { useValue: new HmacOneTimeCodes(env) })
  // prumo:mail
  // Silent under test, where a test registers its own Mailer to read what was sent.
  container.register(MAILER, {
    useValue: new LogMailer((line) => {
      if (env.NODE_ENV !== 'test') {
        console.info(line)
      }
    }),
  })
  // prumo:end-mail
}
