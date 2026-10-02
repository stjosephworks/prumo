import { DomainError } from '@/domain/shared/errors/domain-error'

export class InvalidSessionError extends DomainError {
  readonly kind = 'unauthorized'

  constructor(message = 'Session expired or revoked') {
    super(message)
  }
}
