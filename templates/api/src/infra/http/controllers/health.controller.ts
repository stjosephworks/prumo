import { MikroORM } from '@mikro-orm/postgresql'
import type { FastifyInstance } from 'fastify'

export async function healthController(fastify: FastifyInstance): Promise<void> {
  const orm = fastify.container.resolve(MikroORM)
  const quiet = { config: { public: true }, logLevel: 'silent' } as const

  fastify.get('/live', quiet, async () => ({ status: 'ok' }))

  fastify.get('/ready', quiet, async (_request, reply) => {
    const database = await orm.checkConnection()

    if (!database.ok) {
      return reply.code(503).send({ status: 'error', error: { database: { status: 'down' } } })
    }

    return { status: 'ok', info: { database: { status: 'up' } } }
  })
}
