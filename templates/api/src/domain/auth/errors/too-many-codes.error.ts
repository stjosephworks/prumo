import { DomainError } from '@/domain/shared/errors/domain-error'

// Said for a destination whether or not it has an account, so it tells nobody who signed up.
export class TooManyCodesError extends DomainError {
  readonly kind = 'throttled'
  override readonly code = 'too_many_codes'
  override readonly text = 'tooManyCodes'
  override readonly retryAfter: number

  constructor(retryAfter: number) {
    super()
    this.retryAfter = retryAfter
  }
}
