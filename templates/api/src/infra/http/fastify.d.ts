import type { DependencyContainer } from 'tsyringe'

declare module 'fastify' {
  interface FastifyInstance {
    container: DependencyContainer
  }

  interface FastifyContextConfig {
    public?: boolean
  }

  interface FastifyRequest {
    user?: { id: string }
    sessionId?: string
  }
}
