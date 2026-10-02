import { DomainError } from '@/domain/shared/errors/domain-error'

// Without the provider's word that the address is theirs, an email cannot be trusted to name an account.
export class ProviderEmailUnverifiedError extends DomainError {
  readonly kind = 'forbidden'
  override readonly code = 'provider_email_unverified'

  constructor() {
    super('The provider has not verified this email address')
  }
}
