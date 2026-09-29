import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyInstance } from 'fastify'
import { AUTH, type Auth } from '@/infra/auth/auth.factory'

// Better Auth answers Fetch requests; Fastify has already parsed the body, so the request is rebuilt
// rather than handed over raw, as Better Auth's Fastify guide does.
export async function authController(fastify: FastifyInstance): Promise<void> {
  const auth = fastify.container.resolve<Auth>(AUTH)

  fastify.route({
    method: ['GET', 'POST'],
    url: '/*',
    config: { public: true },
    schema: { hide: true },
    handler: async (request, reply) => {
      const url = new URL(request.url, `${request.protocol}://${request.host}`)
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        }),
      )

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
    },
  })
}
