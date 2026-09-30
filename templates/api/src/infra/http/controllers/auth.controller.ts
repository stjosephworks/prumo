import type { FastifyInstance } from 'fastify'
import { AUTH, type Auth } from '@/infra/auth/auth.factory'
import { sendFetchResponse, toFetchRequest } from '@/infra/http/fetch-bridge'

export async function authController(fastify: FastifyInstance): Promise<void> {
  const auth = fastify.container.resolve<Auth>(AUTH)
  const routes = { config: { public: true }, schema: { hide: true } } as const

  // prumo:mcp
  // OAuth's token endpoint takes a form. It is kept as text and handed to Better Auth as sent.
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => done(null, body),
  )
  // prumo:end-mcp

  fastify.route({
    ...routes,
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) =>
      sendFetchResponse(reply, await auth.handler(toFetchRequest(request))),
  })

  // prumo:mcp
  // OAuth discovery lives at the root, outside Better Auth's base path, and still reaches its handler.
  fastify.route({
    ...routes,
    method: 'GET',
    url: '/.well-known/*',
    handler: async (request, reply) =>
      sendFetchResponse(reply, await auth.handler(toFetchRequest(request))),
  })
  // prumo:end-mcp
}
