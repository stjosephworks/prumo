import { requireMcpAuth } from '@better-auth/mcp'
import type { AuthInfo } from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import { AUTH, type Auth, mcpResource } from '@/infra/auth/auth.factory'
import { ENV, type Env } from '@/infra/config/env'
import { sendFetchResponse, toFetchRequest } from '@/infra/http/fetch-bridge'
import { createMcpServerHandler } from '@/infra/mcp/mcp.server'

type AccessTokenClaims = Parameters<Parameters<typeof requireMcpAuth>[1]>[1]

function authInfoOf(request: Request, claims: AccessTokenClaims): AuthInfo {
  const scope = typeof claims.scope === 'string' ? claims.scope : ''
  const clientId = claims.azp ?? claims.client_id

  return {
    token: request.headers.get('authorization')?.replace(/^\w+\s+/, '') ?? '',
    clientId: typeof clientId === 'string' ? clientId : '',
    scopes: scope.split(' ').filter(Boolean),
    ...(claims.exp === undefined ? {} : { expiresAt: claims.exp }),
    extra: { userId: claims.sub },
  }
}

// The route answers a bearer access token, never a session cookie, so the session hook stands aside.
export async function mcpController(fastify: FastifyInstance): Promise<void> {
  const auth = fastify.container.resolve<Auth>(AUTH)
  const env = fastify.container.resolve<Env>(ENV)
  const mcp = createMcpServerHandler(fastify.container)
  const handle = requireMcpAuth(
    auth,
    (request, claims) => mcp.fetch(request, { authInfo: authInfoOf(request, claims) }),
    { resource: mcpResource(env) },
  )

  fastify.addHook('onClose', () => mcp.close())

  fastify.post('/', { config: { public: true }, schema: { hide: true } }, async (request, reply) =>
    sendFetchResponse(reply, await handle(toFetchRequest(request))),
  )
}
