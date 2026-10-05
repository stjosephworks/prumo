export type DomainErrorKind = 'not_found' | 'conflict' | 'invalid' | 'forbidden' | 'unauthorized'

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind
  // A stable name a client can act on, when the status alone does not say what to do next.
  readonly code?: string
}
