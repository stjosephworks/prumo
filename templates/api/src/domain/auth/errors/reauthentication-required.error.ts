import { DomainError } from '@/domain/shared/errors/domain-error'

// What changes how a person signs in asks for a sign-in of moments ago: a session taken later cannot.
export class ReauthenticationRequiredError extends DomainError {
  readonly kind = 'forbidden'
  override readonly code = 'reauthentication_required'

  constructor() {
    super('Sign in again to do this')
  }
}
