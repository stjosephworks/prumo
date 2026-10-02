import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { emailRequestSchema } from '@/domain/auth/dto/email-request.dto'
import { resetPasswordSchema } from '@/domain/auth/dto/reset-password.dto'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import { verifyEmailSchema } from '@/domain/auth/dto/verify-email.dto'
import { RequestEmailVerificationUseCase } from '@/domain/auth/use-cases/request-email-verification.use-case'
import { RequestPasswordResetUseCase } from '@/domain/auth/use-cases/request-password-reset.use-case'
import { ResetPasswordUseCase } from '@/domain/auth/use-cases/reset-password.use-case'
import { VerifyEmailUseCase } from '@/domain/auth/use-cases/verify-email.use-case'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { sessionDelivery } from '@/infra/http/session-delivery'

// Every route answers alike whether or not the email has an account: none of them can be used to find out.
export async function authEmailController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { deliver } = sessionDelivery(app.container.resolve<Env>(ENV))

  app.post(
    '/email/verification',
    { config: { public: true, ...ATTEMPTS }, schema: { tags: ['auth'], body: emailRequestSchema } },
    async (request, reply) => {
      await app.container.resolve(RequestEmailVerificationUseCase).execute(request.body.email)

      return reply.code(204).send()
    },
  )

  app.post(
    '/email/verify',
    {
      config: { public: true, ...ATTEMPTS },
      schema: { tags: ['auth'], body: verifyEmailSchema, response: { 200: tokensResponseSchema } },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(VerifyEmailUseCase).execute(request.body),
        200,
      ),
  )

  app.post(
    '/password/forgot',
    { config: { public: true, ...ATTEMPTS }, schema: { tags: ['auth'], body: emailRequestSchema } },
    async (request, reply) => {
      await app.container.resolve(RequestPasswordResetUseCase).execute(request.body.email)

      return reply.code(204).send()
    },
  )

  app.post(
    '/password/reset',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        body: resetPasswordSchema,
        response: { 200: tokensResponseSchema },
      },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(ResetPasswordUseCase).execute(request.body),
        200,
      ),
  )
}
