import { DomainError } from '@/domain/shared/errors/domain-error'

// Said for a destination whether or not it has an account, so it tells nobody who signed up.
export class TooManyCodesError extends DomainError {
  readonly kind = 'throttled'
  override readonly code = 'too_many_codes'
  override readonly retryAfter: number

  constructor(retryAfter: number) {
    super('A code was sent to this address too recently')
    this.retryAfter = retryAfter
  }
}
