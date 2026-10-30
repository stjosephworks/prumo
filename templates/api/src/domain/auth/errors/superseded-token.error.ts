import { DomainError } from '@/domain/shared/errors/domain-error'

// Another request rotated this token a moment ago. The client already holds the new one, so it retries instead of
// signing out.
export class SupersededTokenError extends DomainError {
  readonly kind = 'conflict'
  override readonly text = 'supersededToken'
}
