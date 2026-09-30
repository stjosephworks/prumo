import { DomainError } from '@/domain/shared/errors/domain-error'

export class ProfileNotFoundError extends DomainError {
  readonly kind = 'not_found'

  constructor() {
    super('Profile not found')
  }
}
