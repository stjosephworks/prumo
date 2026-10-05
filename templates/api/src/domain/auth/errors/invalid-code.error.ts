import { DomainError } from '@/domain/shared/errors/domain-error'

// One answer for a wrong code, a dead one and an unknown email, so the form does not say which accounts exist.
export class InvalidCodeError extends DomainError {
  readonly kind = 'invalid'
  override readonly code = 'invalid_code'

  constructor() {
    super('The code is wrong or has expired')
  }
}
