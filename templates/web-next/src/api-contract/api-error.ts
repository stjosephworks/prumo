export type FieldErrors = Record<string, string[]>

type ProblemDocument = {
  title?: string
  status?: number
  detail?: string
  requestId?: string
  code?: string
  errors?: FieldErrors
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
  ) {
    super(detail ?? title)
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const requestId = response.headers.get('x-request-id') ?? undefined
    const isProblem = response.headers.get('content-type')?.includes('application/problem+json')

    if (!isProblem) {
      return new ApiError(response.status, response.statusText, undefined, requestId, {})
    }

    const problem = (await response.json()) as ProblemDocument

    return new ApiError(
      response.status,
      problem.title ?? response.statusText,
      problem.detail,
      problem.requestId ?? requestId,
      problem.errors ?? {},
      problem.code,
    )
  }
}
