import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { DomainError, type DomainErrorKind } from '@/domain/shared/errors/domain-error'
import { format } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

type FieldErrors = Record<string, string[]>

type ProblemDocument = {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  requestId: string
  code?: string
  errors?: FieldErrors
}

const STATUS_OF: Record<DomainErrorKind, number> = {
  not_found: 404,
  conflict: 409,
  invalid: 422,
  forbidden: 403,
  unauthorized: 401,
  throttled: 429,
}

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

function fieldOf(instancePath: string, key?: string): string {
  return [...instancePath.split('/').filter(Boolean), ...(key === undefined ? [] : [key])].join('.')
}

// zod wrote each message; only a key it refused is named here.
function fieldErrors(error: FastifyError, messages: Messages): FieldErrors | undefined {
  if (!hasZodFastifySchemaValidationErrors(error)) {
    return undefined
  }

  const fields: FieldErrors = {}
  const add = (field: string, message: string) => {
    fields[field] = [...(fields[field] ?? []), message]
  }

  for (const issue of error.validation) {
    if (issue.keyword === 'unrecognized_keys') {
      for (const key of (issue.params as { keys: string[] }).keys) {
        add(fieldOf(issue.instancePath, key), messages.errors.unrecognizedKey)
      }
    } else {
      add(fieldOf(issue.instancePath), issue.message ?? messages.errors.invalidValue)
    }
  }

  return fields
}

export function statusOf(error: FastifyError): number {
  if (error instanceof DomainError) {
    return STATUS_OF[error.kind]
  }

  return typeof error.statusCode === 'number' ? error.statusCode : 500
}

// prumo:multi-language
// What a person is told, in the request's language. An error that names no message of the API's is a developer's,
// and keeps its words.
// prumo:end-multi-language
// prumo:single-language
// // What a person is told: an error's own words, unless the API failed.
// prumo:end-single-language
function detailOf(
  error: FastifyError,
  status: number,
  errors: FieldErrors | undefined,
  messages: Messages,
): string {
  if (errors !== undefined) {
    return messages.errors.validationFailed
  }

  if (status >= 500) {
    return messages.errors.unexpected
  }

  // prumo:multi-language
  if (error instanceof DomainError && error.text !== undefined) {
    return format(messages.errors[error.text], error.values)
  }

  // prumo:end-multi-language
  return error.message
}

function send(
  request: FastifyRequest,
  reply: FastifyReply,
  problem: Omit<ProblemDocument, 'type' | 'title' | 'instance' | 'requestId'>,
) {
  const document: ProblemDocument = {
    type: 'about:blank',
    title: TITLES[problem.status] ?? 'Error',
    instance: request.url,
    requestId: request.id,
    ...problem,
  }

  return reply.code(problem.status).type('application/problem+json').send(document)
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = statusOf(error)
    const messages = messagesFor(request.locale)
    const errors = fieldErrors(error, messages)

    if (status >= 500) {
      request.log.error(error)
    }

    const code = error instanceof DomainError ? error.code : undefined

    if (error instanceof DomainError && error.retryAfter !== undefined) {
      reply.header('retry-after', String(error.retryAfter))
    }

    return send(request, reply, {
      status,
      detail: detailOf(error, status, errors, messages),
      ...(code === undefined ? {} : { code }),
      ...(errors === undefined ? {} : { errors }),
    })
  })

  app.setNotFoundHandler((request, reply) =>
    send(request, reply, { status: 404, detail: `Cannot ${request.method} ${request.url}` }),
  )
}
