import { DomainError } from '@/domain/shared/errors/domain-error'

export class InvalidSessionError extends DomainError {
  readonly kind = 'unauthorized'
  override readonly text = 'invalidSession'
}
