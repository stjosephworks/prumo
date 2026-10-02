import { inject, injectable } from 'tsyringe'
import type { Authorization } from '@/domain/oauth/entities/authorization.entity'
import { AuthorizationNotFoundError } from '@/domain/oauth/errors/authorization-not-found.error'
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

export type Decision = { authorization: Authorization; code: string | null }

@injectable()
export class DecideAuthorizationUseCase {
  constructor(
    @inject(AUTHORIZATION_REPOSITORY) private readonly authorizations: AuthorizationRepository,
    @inject(AUTHORIZATION_CODES) private readonly codes: AuthorizationCodes,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
  ) {}

  // The user who answers is the user the client will act for.
  execute(id: string, userId: string, accept: boolean): Promise<Decision> {
    return this.transactions.run(async () => {
      const now = new Date()
      const authorization = await this.authorizations.lockById(id)

      if (authorization === null || !authorization.isPending(now)) {
        throw new AuthorizationNotFoundError()
      }

      let code: string | null = null

      if (accept) {
        const secret = this.codes.create()

        authorization.approve(userId, this.codes.digest(secret), now)
        code = authorization.code(secret)
      } else {
        authorization.deny()
      }

      await this.authorizations.save(authorization)

      return { authorization, code }
    })
  }
}
