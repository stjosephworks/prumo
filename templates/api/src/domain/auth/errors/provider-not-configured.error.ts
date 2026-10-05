import { DomainError } from '@/domain/shared/errors/domain-error'

export class ProviderNotConfiguredError extends DomainError {
  readonly kind = 'invalid'
  override readonly code = 'provider_not_configured'

  constructor(provider: string) {
    super(`Sign-in with ${provider} is not configured: set its variables in .env`)
  }
}
