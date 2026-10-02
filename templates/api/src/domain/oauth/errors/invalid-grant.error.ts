import { DomainError } from '@/domain/shared/errors/domain-error'

// OAuth's invalid_grant: the code or refresh token is wrong, spent, expired, or not this client's.
export class InvalidGrantError extends DomainError {
  readonly kind = 'invalid'
}
