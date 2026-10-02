import type { FastifyInstance } from 'fastify'
import { HttpError } from '@/infra/http/errors/http-error'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

// A cookie is sent by the browser whoever wrote the page, so a request that changes something and leans on one must
// come from the web app. A native app and an MCP client send neither a cookie nor an Origin, and pass.
export function registerOriginCheck(app: FastifyInstance, webOrigin: string): void {
  app.addHook('onRequest', async (request) => {
    if (SAFE.has(request.method)) {
      return
    }

    const origin = request.headers.origin
    const leansOnCookie =
      request.headers.cookie !== undefined && request.headers.authorization === undefined

    if ((origin !== undefined && origin !== webOrigin) || (leansOnCookie && origin === undefined)) {
      throw new HttpError(403, 'Cross-origin request refused')
    }
  })
}
