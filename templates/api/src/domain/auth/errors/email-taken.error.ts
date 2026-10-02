import { DomainError } from '@/domain/shared/errors/domain-error'

export class EmailTakenError extends DomainError {
  readonly kind = 'conflict'

  constructor() {
    super('An account with this email already exists')
  }
}
