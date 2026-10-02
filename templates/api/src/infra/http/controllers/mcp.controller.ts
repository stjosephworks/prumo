import type { AuthInfo } from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import { ACCESS_TOKENS, type AccessTokens } from '@/domain/auth/ports/access-tokens.port'
import { ENV, type Env } from '@/infra/config/env'
import { HttpError } from '@/infra/http/errors/http-error'
import { sendFetchResponse, toFetchRequest } from '@/infra/http/fetch-bridge'
import { createMcpServerHandler, mcpResource, mcpResourceMetadataUrl } from '@/infra/mcp/mcp.server'

// The route answers an OAuth access token issued for it, never a session cookie or a first-party token: the
// audience decides, so the session hook stands aside.
export async function mcpController(fastify: FastifyInstance): Promise<void> {
  const tokens = fastify.container.resolve<AccessTokens>(ACCESS_TOKENS)
  const env = fastify.container.resolve<Env>(ENV)
  const resource = mcpResource(env)
  const mcp = createMcpServerHandler(fastify.container)

  fastify.addHook('onClose', () => mcp.close())

  fastify.post(
    '/',
    { config: { public: true }, schema: { hide: true } },
    async (request, reply) => {
      const token = /^Bearer (.+)$/i.exec(request.headers.authorization ?? '')?.[1]
      const claims = token === undefined ? null : await tokens.verify(token, resource)

      if (token === undefined || claims === null || claims.clientId === undefined) {
        // RFC 9728: the 401 names the document that says where to obtain a token.
        reply.header(
          'www-authenticate',
          `Bearer resource_metadata="${mcpResourceMetadataUrl(env)}"${token === undefined ? '' : ', error="invalid_token"'}`,
        )
        throw new HttpError(401, 'Unauthorized')
      }

      const authInfo: AuthInfo = {
        token,
        clientId: claims.clientId,
        scopes: [],
        extra: { userId: claims.userId },
      }

      return sendFetchResponse(reply, await mcp.fetch(toFetchRequest(request), { authInfo }))
    },
  )
}
