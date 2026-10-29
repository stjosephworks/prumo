import { DomainError } from '@/domain/shared/errors/domain-error'

export class EmailNotVerifiedError extends DomainError {
  readonly kind = 'forbidden'
  override readonly code = 'email_not_verified'
  override readonly text = 'emailNotVerified'
}
