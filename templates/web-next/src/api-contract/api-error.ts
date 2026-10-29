export type FieldErrors = Record<string, string[]>

type ProblemDocument = {
  title?: string
  status?: number
  detail?: string
  requestId?: string
  code?: string
  errors?: FieldErrors
}

// Retry-After in seconds; the API never sends the HTTP-date form.
function secondsOf(header: string | null): number | undefined {
  const seconds = Number(header ?? Number.NaN)

  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string | undefined,
    readonly requestId: string | undefined,
    readonly errors: FieldErrors,
    // A stable name for a refusal the client acts on, such as `email_not_verified`.
    readonly code?: string,
    // Seconds to wait before asking again, when the API refused for asking too often.
    readonly retryAfter?: number,
  ) {
    super(detail ?? title)
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const requestId = response.headers.get('x-request-id') ?? undefined
    const retryAfter = secondsOf(response.headers.get('retry-after'))
    const isProblem = response.headers.get('content-type')?.includes('application/problem+json')

    if (!isProblem) {
      return new ApiError(
        response.status,
        response.statusText,
        undefined,
        requestId,
        {},
        undefined,
        retryAfter,
      )
    }

    const problem = (await response.json()) as ProblemDocument

    return new ApiError(
      response.status,
      problem.title ?? response.statusText,
      problem.detail,
      problem.requestId ?? requestId,
      problem.errors ?? {},
      problem.code,
      retryAfter,
    )
  }
}
