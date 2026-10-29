import type { ErrorText } from '@/i18n/messages'

export type DomainErrorKind =
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'forbidden'
  | 'unauthorized'
  | 'throttled'

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind
  // A stable name a client can act on, when the status alone does not say what to do next.
  readonly code?: string
  // For a refusal that lifts with time: how many seconds until asking again may succeed.
  readonly retryAfter?: number
  // What a person is told: a message of the API's, read in the language the request asks for, and the values it
  // names. An error without one is read by a developer, as OAuth's are, and keeps its message as written.
  readonly text?: ErrorText
  readonly values?: Record<string, string>
}
