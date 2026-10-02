import { inject, injectable } from 'tsyringe'
import type { Authorization } from '@/domain/oauth/entities/authorization.entity'
import { AuthorizationNotFoundError } from '@/domain/oauth/errors/authorization-not-found.error'
import {
  AUTHORIZATION_REPOSITORY,
  type AuthorizationRepository,
} from '@/domain/oauth/repositories/authorization.repository'

@injectable()
export class FindAuthorizationUseCase {
  constructor(
    @inject(AUTHORIZATION_REPOSITORY) private readonly authorizations: AuthorizationRepository,
  ) {}

  async execute(id: string): Promise<Authorization> {
    const authorization = await this.authorizations.findById(id)

    if (authorization === null || !authorization.isPending(new Date())) {
      throw new AuthorizationNotFoundError()
    }

    return authorization
  }
}
