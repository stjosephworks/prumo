import { inject, injectable } from 'tsyringe'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

// The mobile app's half: the browser brought back a code, the app trades it once for its own tokens.
@injectable()
export class ExchangeSocialCodeUseCase {
  constructor(
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly startSession: StartSessionUseCase,
  ) {}

  async execute(code: string): Promise<SessionTokens> {
    const parsed = SocialSignIn.parseToken(code)

    const userId = await this.transactions.run(async () => {
      const signIn = parsed === null ? null : await this.signIns.lockById(parsed.id)

      if (
        parsed === null ||
        signIn === null ||
        signIn.userId === null ||
        !signIn.isExchangeable(new Date()) ||
        signIn.exchangeHash !== this.opaque.digest(parsed.secret)
      ) {
        return null
      }

      signIn.exchange()
      await this.signIns.save(signIn)

      return signIn.userId
    })

    if (userId === null) {
      throw new SocialSignInFailedError()
    }

    return this.startSession.execute(userId)
  }
}
