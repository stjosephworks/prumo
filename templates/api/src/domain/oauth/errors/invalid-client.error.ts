import { DomainError } from '@/domain/shared/errors/domain-error'

// The client or its redirect URI cannot be trusted, so the error is shown here and never sent to that URI.
export class InvalidClientError extends DomainError {
  readonly kind = 'invalid'
}
