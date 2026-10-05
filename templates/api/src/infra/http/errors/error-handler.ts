import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { DomainError, type DomainErrorKind } from '@/domain/shared/errors/domain-error'

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

function fieldErrors(error: FastifyError): FieldErrors | undefined {
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
        add(fieldOf(issue.instancePath, key), 'Unrecognized key')
      }
    } else {
      add(fieldOf(issue.instancePath), issue.message ?? 'Invalid value')
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

function detailOf(error: FastifyError, status: number, errors: FieldErrors | undefined): string {
  if (errors !== undefined) {
    return 'Validation failed'
  }

  return status < 500 ? error.message : 'An unexpected error occurred.'
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
    const errors = fieldErrors(error)

    if (status >= 500) {
      request.log.error(error)
    }

    const code = error instanceof DomainError ? error.code : undefined

    return send(request, reply, {
      status,
      detail: detailOf(error, status, errors),
      ...(code === undefined ? {} : { code }),
      ...(errors === undefined ? {} : { errors }),
    })
  })

  app.setNotFoundHandler((request, reply) =>
    send(request, reply, { status: 404, detail: `Cannot ${request.method} ${request.url}` }),
  )
}
