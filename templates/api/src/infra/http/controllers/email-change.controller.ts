import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { emailChangeSchema } from '@/domain/auth/dto/email-change.dto'
import { emailRequestSchema } from '@/domain/auth/dto/email-request.dto'
import { sessionResponseSchema } from '@/domain/auth/dto/session-response.dto'
import { ChangeEmailUseCase } from '@/domain/auth/use-cases/change-email.use-case'
import { RequestEmailChangeUseCase } from '@/domain/auth/use-cases/request-email-change.use-case'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { currentSession, currentUser } from '@/infra/http/hooks/auth.hook'

// The signed-in person's email: a code to the new address, after a sign-in of moments ago, and the address once it
// comes back.
export async function emailChangeController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.post(
    '/email/code',
    {
      config: ATTEMPTS,
      schema: { tags: ['users'], body: emailRequestSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await app.container
        .resolve(RequestEmailChangeUseCase)
        .execute(
          currentUser(request).id,
          currentSession(request),
          request.body.email,
          request.locale,
        )

      return reply.code(204).send(null)
    },
  )

  app.post(
    '/email',
    {
      config: ATTEMPTS,
      schema: {
        tags: ['users'],
        body: emailChangeSchema,
        response: { 200: sessionResponseSchema },
      },
    },
    async (request) => {
      const user = await app.container
        .resolve(ChangeEmailUseCase)
        .execute(currentUser(request).id, request.body)

      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone, // prumo:phone-code
        },
      }
    },
  )
}
