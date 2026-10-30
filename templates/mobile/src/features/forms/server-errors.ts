import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api-contract'
import { format } from '@/i18n/locales'
import type { Messages } from '@/i18n/messages'

export const FORM_ERROR = 'root.server'

export function applyServerError<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
  messages: Messages,
): void {
  if (!(error instanceof ApiError)) {
    throw error
  }

  const unmatched: string[] = []

  for (const [field, texts] of Object.entries(error.errors)) {
    const message = texts.join(' ')

    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
    } else {
      unmatched.push(message)
    }
  }

  if (unmatched.length > 0 || Object.keys(error.errors).length === 0) {
    const detail = unmatched.length > 0 ? unmatched.join(' ') : (error.detail ?? error.title)
    const reference = error.requestId === undefined ? '' : ` (${error.requestId})`
    const wait =
      error.retryAfter === undefined
        ? ''
        : ` ${format(messages.forms.tryAgainIn, { seconds: error.retryAfter })}`

    setError(FORM_ERROR as Path<T>, { type: 'server', message: `${detail}${wait}${reference}` })
  }
}
