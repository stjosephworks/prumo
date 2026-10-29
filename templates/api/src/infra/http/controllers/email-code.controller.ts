import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { emailRequestSchema } from '@/domain/auth/dto/email-request.dto'
import { emailSignInSchema } from '@/domain/auth/dto/email-sign-in.dto'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { RequestSignInCodeUseCase } from '@/domain/auth/use-cases/request-sign-in-code.use-case'
import { SignInWithCodeUseCase } from '@/domain/auth/use-cases/sign-in-with-code.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { sessionDelivery } from '@/infra/http/session-delivery'

// Sign-in and sign-up are one flow: the code goes to any address, and the first one entered creates the account.
export async function emailCodeController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { deliver } = sessionDelivery(app.container.resolve<Env>(ENV))

  app.post(
    '/email/code',
    { config: { public: true, ...ATTEMPTS }, schema: { tags: ['auth'], body: emailRequestSchema } },
    async (request, reply) => {
      await app.container.resolve(RequestSignInCodeUseCase).execute(request.body.email)

      return reply.code(204).send()
    },
  )

  app.post(
    '/email/sign-in',
    {
      config: { public: true, ...ATTEMPTS },
      schema: { tags: ['auth'], body: emailSignInSchema, response: { 200: tokensResponseSchema } },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(SignInWithCodeUseCase).execute(request.body),
        200,
      ),
  )
}
