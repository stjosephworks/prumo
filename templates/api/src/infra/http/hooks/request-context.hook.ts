import { type EntityManager, RequestContext } from '@mikro-orm/postgresql'
import type { FastifyInstance } from 'fastify'

export function registerRequestContext(app: FastifyInstance, em: EntityManager): void {
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id)
    RequestContext.create(em, done)
  })
}
