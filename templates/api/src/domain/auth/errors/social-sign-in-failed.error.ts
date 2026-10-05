import { DomainError } from '@/domain/shared/errors/domain-error'

// Expired, already used, started in another browser, or refused by the provider: the user starts again.
export class SocialSignInFailedError extends DomainError {
  readonly kind = 'unauthorized'
  override readonly code = 'social_sign_in_failed'

  constructor(message = 'The sign-in did not complete. Start again.') {
    super(message)
  }
}
