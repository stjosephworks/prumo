import { DomainError } from '@/domain/shared/errors/domain-error'

// Says nothing about accounts: only whether a number can receive a text from this API at all.
export class InvalidPhoneError extends DomainError {
  readonly kind = 'invalid'
  override readonly code: 'invalid_phone' | 'phone_not_served'
  override readonly text: 'invalidPhone' | 'phoneNotServed' // prumo:multi-language

  constructor(problem: 'invalid' | 'not_served') {
    // prumo:multi-language
    super()
    this.text = problem === 'invalid' ? 'invalidPhone' : 'phoneNotServed'
    // prumo:end-multi-language
    // prumo:single-language
    // super(problem === 'invalid' ? messages.errors.invalidPhone : messages.errors.phoneNotServed)
    // prumo:end-single-language
    this.code = problem === 'invalid' ? 'invalid_phone' : 'phone_not_served'
  }
}
