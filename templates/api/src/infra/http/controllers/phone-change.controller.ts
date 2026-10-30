import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { phoneChangeSchema } from '@/domain/auth/dto/phone-change.dto'
import { phoneRequestSchema } from '@/domain/auth/dto/phone-request.dto'
import { sessionResponseSchema } from '@/domain/auth/dto/session-response.dto'
import { ChangePhoneUseCase } from '@/domain/auth/use-cases/change-phone.use-case'
import { RequestPhoneChangeUseCase } from '@/domain/auth/use-cases/request-phone-change.use-case'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { currentSession, currentUser } from '@/infra/http/hooks/auth.hook'

// The signed-in person's phone: a code texted to the new number, after a sign-in of moments ago, and the number once
// it comes back.
export async function phoneChangeController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.post(
    '/phone/code',
    {
      config: ATTEMPTS,
      schema: { tags: ['users'], body: phoneRequestSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await app.container
        .resolve(RequestPhoneChangeUseCase)
        .execute(
          currentUser(request).id,
          currentSession(request),
          request.body.phone,
          request.locale,
        )

      return reply.code(204).send(null)
    },
  )

  app.post(
    '/phone',
    {
      config: ATTEMPTS,
      schema: {
        tags: ['users'],
        body: phoneChangeSchema,
        response: { 200: sessionResponseSchema },
      },
    },
    async (request) => {
      const user = await app.container
        .resolve(ChangePhoneUseCase)
        .execute(currentUser(request).id, request.body)

      return { user: { id: user.id, email: user.email, phone: user.phone } }
    },
  )
}
