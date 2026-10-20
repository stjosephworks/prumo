import type { FastifyInstance } from 'fastify'
import { HttpError } from '@/infra/http/errors/http-error'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

// A cookie is sent by the browser whoever wrote the page, so a request that changes something and leans on one must
// come from one of the web apps. Without a cookie there is nothing for another site to borrow: a native app and an
// MCP client send a bearer, and pass.
export function registerOriginCheck(app: FastifyInstance, webOrigins: string[]): void {
  app.addHook('onRequest', async (request) => {
    const leansOnCookie =
      request.headers.cookie !== undefined && request.headers.authorization === undefined

    if (SAFE.has(request.method) || !leansOnCookie) {
      return
    }

    if (request.headers.origin === undefined || !webOrigins.includes(request.headers.origin)) {
      throw new HttpError(403, 'Cross-origin request refused')
    }
  })
}
