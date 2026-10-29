import { DomainError } from '@/domain/shared/errors/domain-error'

export class ProfileNotFoundError extends DomainError {
  readonly kind = 'not_found'
  override readonly text = 'profileNotFound'
}
