import { DomainError } from '@/domain/shared/errors/domain-error'

export class ProviderNotConfiguredError extends DomainError {
  readonly kind = 'invalid'
  override readonly code = 'provider_not_configured'
  // prumo:multi-language
  override readonly text = 'providerNotConfigured'
  override readonly values: { provider: string }

  constructor(provider: string) {
    super()
    this.values = { provider }
  }
  // prumo:end-multi-language
  // prumo:single-language
  // constructor(provider: string) {
  //   super(format(messages.errors.providerNotConfigured, { provider }))
  // }
  // prumo:end-single-language
}
