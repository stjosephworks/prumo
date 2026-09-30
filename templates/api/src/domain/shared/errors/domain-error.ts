export type DomainErrorKind = 'not_found' | 'conflict' | 'invalid' | 'forbidden' | 'unauthorized'

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind
}
