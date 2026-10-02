import { inject, injectable } from 'tsyringe'
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import type { SessionTokens } from '@/domain/auth/use-cases/start-session.use-case'
import { StartSessionUseCase } from '@/domain/auth/use-cases/start-session.use-case'
import { Authorization } from '@/domain/oauth/entities/authorization.entity'
import { InvalidGrantError } from '@/domain/oauth/errors/invalid-grant.error'
import {
  AUTHORIZATION_CODES,
  type AuthorizationCodes,
} from '@/domain/oauth/ports/authorization-codes.port'
import {
  AUTHORIZATION_REPOSITORY,
  type AuthorizationRepository,
} from '@/domain/oauth/repositories/authorization.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'

export type CodeExchange = {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
  resource: string
}

@injectable()
export class ExchangeCodeUseCase {
  constructor(
    @inject(AUTHORIZATION_REPOSITORY) private readonly authorizations: AuthorizationRepository,
    @inject(AUTHORIZATION_CODES) private readonly codes: AuthorizationCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly startSession: StartSessionUseCase,
    private readonly signOut: SignOutUseCase,
  ) {}

  async execute(request: CodeExchange): Promise<SessionTokens> {
    const parsed = Authorization.parseCode(request.code)

    if (parsed === null) {
      throw new InvalidGrantError('Unknown authorization code')
    }

    const outcome = await this.transactions.run(async () => {
      const now = new Date()
      const authorization = await this.authorizations.lockById(parsed.authorizationId)

      if (authorization === null || authorization.codeHash !== this.codes.digest(parsed.secret)) {
        return { error: 'Unknown authorization code' }
      }

      // A code presented twice was copied: the tokens the first use obtained are no longer trusted either.
      if (authorization.status === 'exchanged' && authorization.userId !== null) {
        if (authorization.sessionId !== null) {
          await this.signOut.execute(authorization.userId, authorization.sessionId)
        }

        return { error: 'Authorization code already used' }
      }

      if (!authorization.isRedeemable(now) || authorization.userId === null) {
        return { error: 'Authorization code expired' }
      }

      if (
        authorization.clientId !== request.clientId ||
        authorization.redirectUri !== request.redirectUri ||
        authorization.resource !== request.resource
      ) {
        return { error: 'The code was issued for another client, redirect URI or resource' }
      }

      if (!this.codes.matchesChallenge(request.codeVerifier, authorization.codeChallenge)) {
        return { error: 'code_verifier does not match the code_challenge' }
      }

      const tokens = await this.startSession.execute(authorization.userId, {
        clientId: authorization.clientId,
        resource: authorization.resource,
      })

      authorization.exchange(tokens.sessionId)
      await this.authorizations.save(authorization)

      return { tokens }
    })

    // Thrown after the transaction, so revoking a copied code's session is committed and not rolled back.
    if ('error' in outcome) {
      throw new InvalidGrantError(outcome.error)
    }

    return outcome.tokens
  }
}
