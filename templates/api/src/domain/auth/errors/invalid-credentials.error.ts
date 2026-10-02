import { DomainError } from '@/domain/shared/errors/domain-error'

// One message for an unknown email and a wrong password, so the answer does not say which accounts exist.
export class InvalidCredentialsError extends DomainError {
  readonly kind = 'unauthorized'

  constructor() {
    super('Invalid email or password')
  }
}
