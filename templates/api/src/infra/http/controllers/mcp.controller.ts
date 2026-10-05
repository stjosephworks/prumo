import type { AuthInfo } from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import { ACCESS_TOKENS, type AccessTokens } from '@/domain/auth/ports/access-tokens.port'
import { ENV, type Env } from '@/infra/config/env'
import { HttpError } from '@/infra/http/errors/http-error'
import { sendFetchResponse, toFetchRequest } from '@/infra/http/fetch-bridge'
import { missingScopes, SCOPES } from '@/infra/mcp/mcp.scopes'
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
        // RFC 9728: the 401 names the document that says where to obtain a token, and the scopes worth asking for.
        reply.header(
          'www-authenticate',
          `Bearer resource_metadata="${mcpResourceMetadataUrl(env)}", scope="${Object.keys(SCOPES).join(' ')}"${token === undefined ? '' : ', error="invalid_token"'}`,
        )
        throw new HttpError(401, 'Unauthorized')
      }

      const scopes = (claims.scope ?? '').split(' ').filter(Boolean)
      const missing = missingScopes(request.body, scopes)

      // Checked before the server runs the call: a tool the user did not grant is refused with the scopes it needs,
      // so the client can ask the user for them and come back.
      if (missing.length > 0) {
        reply.header(
          'www-authenticate',
          `Bearer error="insufficient_scope", scope="${missing.join(' ')}", resource_metadata="${mcpResourceMetadataUrl(env)}"`,
        )
        throw new HttpError(403, `This token lacks ${missing.join(' ')}`)
      }

      const authInfo: AuthInfo = {
        token,
        clientId: claims.clientId,
        scopes,
        extra: { userId: claims.userId },
      }

      return sendFetchResponse(reply, await mcp.fetch(toFetchRequest(request), { authInfo }))
    },
  )
}
