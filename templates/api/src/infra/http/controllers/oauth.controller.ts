import type { FastifyInstance, FastifyReply } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { SupersededTokenError } from '@/domain/auth/errors/superseded-token.error'
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import type { SessionTokens } from '@/domain/auth/use-cases/start-session.use-case'
import {
  authorizationDecisionSchema,
  authorizationRedirectSchema,
} from '@/domain/oauth/dto/authorization-decision.dto'
import { authorizationViewSchema } from '@/domain/oauth/dto/authorization-view.dto'
import { AuthorizationRequestError } from '@/domain/oauth/errors/authorization-request.error'
import { InvalidGrantError } from '@/domain/oauth/errors/invalid-grant.error'
import { DecideAuthorizationUseCase } from '@/domain/oauth/use-cases/decide-authorization.use-case'
import { ExchangeCodeUseCase } from '@/domain/oauth/use-cases/exchange-code.use-case'
import { FindAuthorizationUseCase } from '@/domain/oauth/use-cases/find-authorization.use-case'
import { StartAuthorizationUseCase } from '@/domain/oauth/use-cases/start-authorization.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { currentUser } from '@/infra/http/hooks/auth.hook'
import { mcpResource } from '@/infra/mcp/mcp.server'

const PUBLIC = { public: true, rateLimit: { max: 30, timeWindow: '1 minute' } }
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

const authorizeQuerySchema = z.object({
  response_type: z.string().optional(),
  client_id: z.string().max(2048),
  redirect_uri: z.string().max(2048),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  state: z.string().max(1024).optional(),
  resource: z.string().optional(),
  scope: z.string().optional(),
})

const idParamsSchema = z.object({ id: z.uuid() })

function withParams(uri: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(uri)

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

function tokenResponse(tokens: SessionTokens) {
  return {
    access_token: tokens.accessToken.token,
    token_type: 'Bearer',
    expires_in: Math.round((tokens.accessToken.expiresAt.getTime() - Date.now()) / 1000),
    refresh_token: tokens.refreshToken,
  }
}

// MCP's authorization server, from discovery to the token: RFC 9728, RFC 8414, OAuth 2.1 with PKCE, RFC 8707 and
// RFC 9207, with clients identified by their metadata document. The user signs in and consents on the web app.
export async function oauthController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const env = app.container.resolve<Env>(ENV)
  const issuer = env.API_URL
  const resource = mcpResource(env)

  // The token endpoint takes a form, as OAuth writes it.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(body as string))),
  )

  const resourceMetadata = {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
  }

  // At the path of the resource first, then at the root: the two places an MCP client looks.
  for (const url of [
    '/.well-known/oauth-protected-resource/api/mcp',
    '/.well-known/oauth-protected-resource',
  ]) {
    app.get(url, { config: { public: true }, schema: { hide: true } }, async () => resourceMetadata)
  }

  app.get(
    '/.well-known/oauth-authorization-server',
    { config: { public: true }, schema: { hide: true } },
    async () => ({
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    }),
  )

  app.get(
    '/api/oauth/authorize',
    { config: PUBLIC, schema: { tags: ['oauth'], querystring: authorizeQuerySchema } },
    async (request, reply) => {
      const query = request.query

      try {
        const authorization = await app.container.resolve(StartAuthorizationUseCase).execute(
          {
            responseType: query.response_type,
            clientId: query.client_id,
            redirectUri: query.redirect_uri,
            codeChallenge: query.code_challenge,
            codeChallengeMethod: query.code_challenge_method,
            clientState: query.state ?? null,
            resource: query.resource,
          },
          resource,
        )

        // Signing in, if needed, and the consent itself happen on the web app.
        return reply.redirect(`${env.WEB_ORIGIN}/consent?request=${authorization.id}`)
      } catch (error) {
        if (error instanceof AuthorizationRequestError) {
          return reply.redirect(
            withParams(query.redirect_uri, {
              error: error.code,
              error_description: error.message,
              state: query.state,
              iss: issuer,
            }),
          )
        }

        throw error
      }
    },
  )

  app.get(
    '/api/oauth/authorizations/:id',
    {
      schema: {
        tags: ['oauth'],
        params: idParamsSchema,
        response: { 200: authorizationViewSchema },
      },
    },
    async (request) => {
      const authorization = await app.container
        .resolve(FindAuthorizationUseCase)
        .execute(request.params.id)
      const redirect = new URL(authorization.redirectUri)

      return {
        clientId: authorization.clientId,
        clientName: authorization.clientName,
        clientHost: new URL(authorization.clientId).host,
        redirectHost: redirect.host,
        redirectsToThisDevice: LOOPBACK.has(redirect.hostname),
      }
    },
  )

  app.post(
    '/api/oauth/authorizations/:id/decision',
    {
      schema: {
        tags: ['oauth'],
        params: idParamsSchema,
        body: authorizationDecisionSchema,
        response: { 200: authorizationRedirectSchema },
      },
    },
    async (request) => {
      const { authorization, code } = await app.container
        .resolve(DecideAuthorizationUseCase)
        .execute(request.params.id, currentUser(request).id, request.body.accept)

      return {
        redirectTo: withParams(authorization.redirectUri, {
          ...(code === null ? { error: 'access_denied' } : { code }),
          state: authorization.clientState,
          iss: issuer,
        }),
      }
    },
  )

  // Errors here are OAuth's, not problem+json: an MCP client reads `error` and `error_description`.
  app.post(
    '/api/oauth/token',
    { config: PUBLIC, schema: { tags: ['oauth'] } },
    async (request, reply: FastifyReply) => {
      const body = (request.body ?? {}) as Record<string, string | undefined>
      const fail = (error: string, description: string) =>
        reply.code(400).send({ error, error_description: description })

      reply.header('cache-control', 'no-store')

      if (body.resource !== undefined && body.resource !== resource) {
        return fail('invalid_target', `resource must be ${resource}`)
      }

      try {
        if (body.grant_type === 'authorization_code') {
          const { code, client_id, redirect_uri, code_verifier } = body

          if (!code || !client_id || !redirect_uri || !code_verifier) {
            return fail(
              'invalid_request',
              'code, client_id, redirect_uri and code_verifier are required',
            )
          }

          return tokenResponse(
            await app.container.resolve(ExchangeCodeUseCase).execute({
              code,
              clientId: client_id,
              redirectUri: redirect_uri,
              codeVerifier: code_verifier,
              resource,
            }),
          )
        }

        if (body.grant_type === 'refresh_token') {
          if (!body.refresh_token || !body.client_id) {
            return fail('invalid_request', 'refresh_token and client_id are required')
          }

          return tokenResponse(
            await app.container
              .resolve(RefreshSessionUseCase)
              .execute(body.refresh_token, body.client_id),
          )
        }

        return fail('unsupported_grant_type', 'Only authorization_code and refresh_token')
      } catch (error) {
        if (
          error instanceof InvalidGrantError ||
          error instanceof InvalidSessionError ||
          error instanceof SupersededTokenError
        ) {
          return fail('invalid_grant', error.message)
        }

        throw error
      }
    },
  )
}
