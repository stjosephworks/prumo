import type { DependencyContainer } from 'tsyringe'
import type { Locale } from '@/i18n/locales'

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
    // The language the request asks for, among the project's: see hooks/locale.hook.ts.
    locale: Locale
  }
}
