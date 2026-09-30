import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { AUTH, type Auth, type AuthUser } from '@/infra/auth/auth.factory'
import { HttpError } from '@/infra/http/errors/http-error'

export function registerAuthHook(app: FastifyInstance): void {
  const auth = app.container.resolve<Auth>(AUTH)

  app.addHook('preHandler', async (request) => {
    // An unknown route answers 404, not 401: there is nothing there to protect.
    if (request.is404) {
      return
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })

    request.user = session?.user
    request.session = session?.session

    if (request.routeOptions.config.public !== true && session === null) {
      throw new HttpError(401, 'Unauthorized')
    }
  })
}

export function currentUser(request: FastifyRequest): AuthUser {
  if (request.user === undefined) {
    throw new HttpError(401, 'Unauthorized')
  }

  return request.user
}
