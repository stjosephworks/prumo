import type { FastifyInstance, FastifyRequest } from 'fastify'
import { ACCESS_TOKENS, type AccessTokens } from '@/domain/auth/ports/access-tokens.port'
import { HttpError } from '@/infra/http/errors/http-error'

export const ACCESS_COOKIE = 'access_token'

// The web sends a cookie the browser keeps; a native app and an MCP client send a bearer token.
function tokenOf(request: FastifyRequest): string | undefined {
  const bearer = /^Bearer (.+)$/i.exec(request.headers.authorization ?? '')?.[1]

  return bearer ?? request.cookies[ACCESS_COOKIE]
}

export function registerAuthHook(app: FastifyInstance): void {
  const tokens = app.container.resolve<AccessTokens>(ACCESS_TOKENS)

  app.addHook('preHandler', async (request) => {
    // An unknown route answers 404, not 401: there is nothing there to protect.
    if (request.is404) {
      return
    }

    const token = tokenOf(request)
    const claims = token === undefined ? null : await tokens.verify(token)

    request.user = claims === null ? undefined : { id: claims.userId }
    request.sessionId = claims?.sessionId

    if (request.routeOptions.config.public !== true && claims === null) {
      throw new HttpError(401, 'Unauthorized')
    }
  })
}

export function currentUser(request: FastifyRequest): { id: string } {
  if (request.user === undefined) {
    throw new HttpError(401, 'Unauthorized')
  }

  return request.user
}

export function currentSession(request: FastifyRequest): string {
  if (request.sessionId === undefined) {
    throw new HttpError(401, 'Unauthorized')
  }

  return request.sessionId
}
