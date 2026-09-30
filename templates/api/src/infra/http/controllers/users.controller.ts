import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { profileResponseSchema } from '@/domain/users/dto/profile-response.dto'
import { updateProfileSchema } from '@/domain/users/dto/update-profile.dto'
import { FindProfileUseCase } from '@/domain/users/use-cases/find-profile.use-case'
import { UpdateProfileUseCase } from '@/domain/users/use-cases/update-profile.use-case'
import { currentUser } from '@/infra/http/hooks/auth.hook'

export async function usersController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get(
    '/me',
    { schema: { tags: ['users'], response: { 200: profileResponseSchema } } },
    async (request) => {
      return app.container.resolve(FindProfileUseCase).execute(currentUser(request).id)
    },
  )

  app.patch(
    '/me',
    {
      schema: {
        tags: ['users'],
        body: updateProfileSchema,
        response: { 200: profileResponseSchema },
      },
    },
    async (request) => {
      return app.container
        .resolve(UpdateProfileUseCase)
        .execute(currentUser(request).id, request.body)
    },
  )
}
