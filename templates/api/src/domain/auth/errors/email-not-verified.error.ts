import { DomainError } from '@/domain/shared/errors/domain-error'

export class EmailNotVerifiedError extends DomainError {
  readonly kind = 'forbidden'
  override readonly code = 'email_not_verified'

  constructor() {
    super('Confirm your email before signing in')
  }
}
