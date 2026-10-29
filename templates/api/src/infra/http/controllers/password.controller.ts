import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { signInSchema } from '@/domain/auth/dto/sign-in.dto'
import { signUpSchema } from '@/domain/auth/dto/sign-up.dto'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { sessionDelivery } from '@/infra/http/session-delivery'

const verificationRequiredSchema = z.object({ verificationRequired: z.literal(true) })

// An account with a password: created here, and signed into with it.
export async function passwordController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { deliver } = sessionDelivery(app.container.resolve<Env>(ENV))

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
      const tokens = await app.container
        .resolve(SignUpUseCase)
        .execute({ ...request.body, locale: request.body.locale ?? request.locale })

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
}
