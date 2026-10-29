import { DomainError } from '@/domain/shared/errors/domain-error'

// Says nothing about accounts: only whether a number can receive a text from this API at all.
export class InvalidPhoneError extends DomainError {
  readonly kind = 'invalid'
  override readonly code: 'invalid_phone' | 'phone_not_served'
  override readonly text: 'invalidPhone' | 'phoneNotServed'

  constructor(problem: 'invalid' | 'not_served') {
    super()
    this.code = problem === 'invalid' ? 'invalid_phone' : 'phone_not_served'
    this.text = problem === 'invalid' ? 'invalidPhone' : 'phoneNotServed'
  }
}
