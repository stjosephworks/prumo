import { DomainError } from '@/domain/shared/errors/domain-error'
import type { ErrorText } from '@/i18n/messages' // prumo:multi-language

// Expired, already used, started in another browser, or refused by the provider: the user starts again.
export class SocialSignInFailedError extends DomainError {
  readonly kind = 'unauthorized'
  override readonly code = 'social_sign_in_failed'
  // prumo:multi-language
  override readonly text: ErrorText
  override readonly values: Record<string, string>

  constructor(text: ErrorText = 'socialSignInFailed', values: Record<string, string> = {}) {
    super()
    this.text = text
    this.values = values
  }
  // prumo:end-multi-language
  // prumo:single-language
  // constructor(message = messages.errors.socialSignInFailed) {
  //   super(message)
  // }
  // prumo:end-single-language
}
