import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'
import { DomainError } from '@/domain/shared/errors/domain-error'

// The account signs in with a provider whose authorization must be revoked with it, which takes one more trip there.
export class ProviderConfirmationRequiredError extends DomainError {
  readonly kind = 'conflict'
  override readonly code = 'provider_confirmation_required'
  // prumo:multi-language
  override readonly text = 'providerConfirmationRequired'
  override readonly values: { provider: string }

  constructor(readonly provider: ProviderName) {
    super()
    this.values = { provider }
  }
  // prumo:end-multi-language
  // prumo:single-language
  // constructor(readonly provider: ProviderName) {
  //   super(format(messages.errors.providerConfirmationRequired, { provider }))
  // }
  // prumo:end-single-language
}
