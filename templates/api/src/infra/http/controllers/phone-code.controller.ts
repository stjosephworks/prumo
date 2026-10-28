import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { phoneRequestSchema } from '@/domain/auth/dto/phone-request.dto'
import { phoneSignInSchema } from '@/domain/auth/dto/phone-sign-in.dto'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { RequestPhoneCodeUseCase } from '@/domain/auth/use-cases/request-phone-code.use-case'
import { SignInWithPhoneCodeUseCase } from '@/domain/auth/use-cases/sign-in-with-phone-code.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { sessionDelivery } from '@/infra/http/session-delivery'

// Sign-in and sign-up are one flow: the code goes to any mobile number the API texts, and the first one entered
// creates the account.
export async function phoneCodeController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { deliver } = sessionDelivery(app.container.resolve<Env>(ENV))

  app.post(
    '/phone/code',
    { config: { public: true, ...ATTEMPTS }, schema: { tags: ['auth'], body: phoneRequestSchema } },
    async (request, reply) => {
      await app.container.resolve(RequestPhoneCodeUseCase).execute(request.body.phone)

      return reply.code(204).send()
    },
  )

  app.post(
    '/phone/sign-in',
    {
      config: { public: true, ...ATTEMPTS },
      schema: { tags: ['auth'], body: phoneSignInSchema, response: { 200: tokensResponseSchema } },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(SignInWithPhoneCodeUseCase).execute(request.body),
        200,
      ),
  )
}
