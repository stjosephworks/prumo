import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyReply, FastifyRequest } from 'fastify'

function bodyOf(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined
  }

  return typeof body === 'string' ? body : JSON.stringify(body)
}

// Better Auth and the MCP handler answer Fetch requests. Fastify has already parsed a JSON body, so the
// request is rebuilt rather than handed over raw, as Better Auth's Fastify guide does; a body kept as a
// string, such as a form, passes unchanged.
export function toFetchRequest(request: FastifyRequest): Request {
  const body = bodyOf(request.body)

  return new Request(new URL(request.url, `${request.protocol}://${request.host}`), {
    method: request.method,
    headers: fromNodeHeaders(request.headers),
    ...(body === undefined ? {} : { body }),
  })
}

export async function sendFetchResponse(
  reply: FastifyReply,
  response: Response,
): Promise<FastifyReply> {
  reply.status(response.status)

  for (const [key, value] of response.headers) {
    if (key !== 'set-cookie') {
      reply.header(key, value)
    }
  }

  for (const cookie of response.headers.getSetCookie()) {
    reply.header('set-cookie', cookie)
  }

  return reply.send(response.body === null ? null : await response.text())
}
