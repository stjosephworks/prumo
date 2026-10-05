import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { refreshSchema } from '@/domain/auth/dto/refresh.dto'
import { sessionResponseSchema } from '@/domain/auth/dto/session-response.dto'
import { signInSchema } from '@/domain/auth/dto/sign-in.dto'
import { signUpSchema } from '@/domain/auth/dto/sign-up.dto'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { InvalidSessionError } from '@/domain/auth/errors/invalid-session.error'
import { FindUserUseCase } from '@/domain/auth/use-cases/find-user.use-case'
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case'
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { currentSession, currentUser } from '@/infra/http/hooks/auth.hook'
import { REFRESH_COOKIE, sessionDelivery, wantsBearer } from '@/infra/http/session-delivery'

// Repeated guessing is slowed down per address; a refresh happens every quarter hour per tab, so it gets more room.
export const ATTEMPTS = { rateLimit: { max: 10, timeWindow: '1 minute' } }
const REFRESHES = { rateLimit: { max: 60, timeWindow: '1 minute' } }

const verificationRequiredSchema = z.object({ verificationRequired: z.literal(true) })

export async function authController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { deliver, clearCookies } = sessionDelivery(app.container.resolve<Env>(ENV))

  app.post(
    '/sign-up',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        body: signUpSchema,
        response: { 201: z.union([tokensResponseSchema, verificationRequiredSchema]) },
      },
    },
    async (request, reply) => {
      const tokens = await app.container.resolve(SignUpUseCase).execute(request.body)

      // No session until the address is confirmed: the client asks for the code next.
      if (tokens === null) {
        return reply.code(201).send({ verificationRequired: true })
      }

      return deliver(request, reply, tokens, 201)
    },
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
