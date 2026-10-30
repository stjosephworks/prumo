import { DomainError } from '@/domain/shared/errors/domain-error'

export class EmailTakenError extends DomainError {
  readonly kind = 'conflict'
  override readonly text = 'emailTaken'
}
