import type { DependencyContainer } from 'tsyringe'
import type { AuthSession, AuthUser } from '@/infra/auth/auth.factory'

declare module 'fastify' {
  interface FastifyInstance {
    container: DependencyContainer
  }

  interface FastifyContextConfig {
    public?: boolean
  }

  interface FastifyRequest {
    user?: AuthUser
    session?: NonNullable<AuthSession>['session']
  }
}
