import type { Transport } from '@/api-contract'

export const API_URL = 'http://api.test'

type Handler = (request: Request) => Response | Promise<Response>

export function json(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } })
}

export function fakeTransport(routes: Record<string, Handler>): Transport {
  return async (input, init) => {
    const request = new Request(input, init)
    const key = `${request.method} ${new URL(request.url).pathname}`
    const handler = routes[key]

    if (handler === undefined) {
      throw new Error(`No fake response for ${key}`)
    }

    return handler(request)
  }
}
