import { DomainError } from '@/domain/shared/errors/domain-error'

// Says nothing about accounts: only whether a number can receive a text from this API at all.
export class InvalidPhoneError extends DomainError {
  readonly kind = 'invalid'
  override readonly code: 'invalid_phone' | 'phone_not_served'

  constructor(problem: 'invalid' | 'not_served') {
    super(
      problem === 'invalid'
        ? 'Enter a mobile number with its country code, as +1 415 555 2671'
        : 'Texts are not sent to numbers in that country',
    )
    this.code = problem === 'invalid' ? 'invalid_phone' : 'phone_not_served'
  }
}
