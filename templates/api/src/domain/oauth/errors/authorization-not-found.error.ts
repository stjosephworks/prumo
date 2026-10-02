import { DomainError } from '@/domain/shared/errors/domain-error'

export class AuthorizationNotFoundError extends DomainError {
  readonly kind = 'not_found'

  constructor() {
    super('This authorization request has expired or was already answered')
  }
}
