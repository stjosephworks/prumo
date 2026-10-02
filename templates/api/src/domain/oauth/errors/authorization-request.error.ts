import { DomainError } from '@/domain/shared/errors/domain-error'

// A request from a client already known to be who it says, with a redirect URI it registered: the error goes back
// to that URI, in OAuth's own terms.
export class AuthorizationRequestError extends DomainError {
  readonly kind = 'invalid'

  constructor(
    readonly code: 'invalid_request' | 'unsupported_response_type' | 'invalid_target',
    message: string,
  ) {
    super(message)
  }
}
