import { ApiError } from './api-error'

export type Transport = typeof fetch

export type ApiClient = ReturnType<typeof createClient>

export function createClient({ baseUrl, fetch }: { baseUrl: string; fetch: Transport }) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
      throw await ApiError.fromResponse(response)
    }

    return (await response.json()) as T
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  }
}
