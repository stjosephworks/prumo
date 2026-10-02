import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { refreshSchema } from '@/domain/auth/dto/refresh.dto'
import { sessionResponseSchema } from '@/domain/auth/dto/session-response.dto'
import { signInSchema } from '@/domain/auth/dto/sign-in.dto'
import { signUpSchema } from '@/domain/auth/dto/sign-up.dto'
import { type TokensResponseDto, tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { FindUserUseCase } from '@/domain/auth/use-cases/find-user.use-case'
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case'
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case'
import type { SessionTokens } from '@/domain/auth/use-cases/start-session.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { ACCESS_COOKIE, currentSession, currentUser } from '@/infra/http/hooks/auth.hook'

const REFRESH_COOKIE = 'refresh_token'

// The refresh cookie travels only to the one route that reads it, never with an ordinary request.
const REFRESH_PATH = '/api/auth/refresh'

// Repeated guessing is slowed down per address; a refresh happens every quarter hour per tab, so it gets more room.
const ATTEMPTS = { rateLimit: { max: 10, timeWindow: '1 minute' } }
const REFRESHES = { rateLimit: { max: 60, timeWindow: '1 minute' } }

// A native client asks for its tokens in the body. The web never does: a token JavaScript can read is a token an
// injected script can take.
function wantsBearer(request: FastifyRequest): boolean {
  return request.headers['x-auth-transport'] === 'bearer'
}

function asBody(tokens: SessionTokens): TokensResponseDto {
  return {
    accessToken: tokens.accessToken.token,
    refreshToken: tokens.refreshToken,
    expiresIn: Math.round((tokens.accessToken.expiresAt.getTime() - Date.now()) / 1000),
  }
}

export async function authController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const env = app.container.resolve<Env>(ENV)
  const secure = env.API_URL.startsWith('https://')
  const cookie = { httpOnly: true, sameSite: 'lax', secure } as const

  function setCookies(reply: FastifyReply, tokens: SessionTokens): void {
    reply.setCookie(ACCESS_COOKIE, tokens.accessToken.token, {
      ...cookie,
      path: '/',
      expires: tokens.accessToken.expiresAt,
    })
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookie,
      path: REFRESH_PATH,
      expires: tokens.refreshExpiresAt,
    })
  }

  function clearCookies(reply: FastifyReply): void {
    reply.clearCookie(ACCESS_COOKIE, { ...cookie, path: '/' })
    reply.clearCookie(REFRESH_COOKIE, { ...cookie, path: REFRESH_PATH })
  }

  // The web gets cookies and an empty body; a native client gets the tokens and no cookie.
  function deliver(
    request: FastifyRequest,
    reply: FastifyReply,
    tokens: SessionTokens,
    status: number,
  ) {
    if (wantsBearer(request)) {
      return reply.code(status).send(asBody(tokens))
    }

    setCookies(reply, tokens)
    return reply.code(status === 201 ? 201 : 204).send()
  }

  app.post(
    '/sign-up',
    {
      config: { public: true, ...ATTEMPTS },
      schema: { tags: ['auth'], body: signUpSchema, response: { 201: tokensResponseSchema } },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(SignUpUseCase).execute(request.body),
        201,
      ),
  )

  app.post(
    '/sign-in',
    {
      config: { public: true, ...ATTEMPTS },
      schema: { tags: ['auth'], body: signInSchema, response: { 200: tokensResponseSchema } },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(SignInUseCase).execute(request.body),
        200,
      ),
  )

  app.post(
    '/refresh',
    {
      config: { public: true, ...REFRESHES },
      schema: { tags: ['auth'], body: refreshSchema, response: { 200: tokensResponseSchema } },
    },
    async (request, reply) => {
      const token = request.body?.refreshToken ?? request.cookies[REFRESH_COOKIE]

      try {
        if (token === undefined) {
          throw new InvalidSessionError()
        }

        return deliver(
          request,
          reply,
          await app.container.resolve(RefreshSessionUseCase).execute(token),
          200,
        )
      } catch (error) {
        // A refresh that cannot succeed will not succeed later either: drop what the browser holds.
        if (error instanceof InvalidSessionError && !wantsBearer(request)) {
          clearCookies(reply)
        }

        throw error
      }
    },
  )

  app.post('/sign-out', { schema: { tags: ['auth'] } }, async (request, reply) => {
    await app.container
      .resolve(SignOutUseCase)
      .execute(currentUser(request).id, currentSession(request))
    clearCookies(reply)

    return reply.code(204).send()
  })

  app.get(
    '/session',
    { schema: { tags: ['auth'], response: { 200: sessionResponseSchema } } },
    async (request) => {
      const user = await app.container.resolve(FindUserUseCase).execute(currentUser(request).id)

      return { user: { id: user.id, email: user.email } }
    },
  )
}
