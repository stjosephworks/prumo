import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'
import { DomainError } from '@/domain/shared/errors/domain-error'

// The account signs in with a provider whose authorization must be revoked with it, which takes one more trip there.
export class ProviderConfirmationRequiredError extends DomainError {
  readonly kind = 'conflict'
  override readonly code = 'provider_confirmation_required'

  constructor(readonly provider: ProviderName) {
    super(`Confirm with ${provider} to delete this account`)
  }
}
