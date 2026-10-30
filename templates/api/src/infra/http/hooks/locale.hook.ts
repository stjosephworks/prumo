import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BASE_LOCALE, type Locale, negotiateLocale, parseAcceptLanguage } from '@/i18n/locales'

// zod's own messages, in each of the project's languages: a validation error is written in the request's while the
// value it refused is still at hand, which the error handler no longer has.
export const ZOD_MESSAGES: Record<Locale, z.core.$ZodErrorMap> = {
  en: z.locales.en().localeError, // prumo:en
  'pt-BR': z.locales.pt().localeError, // prumo:pt-BR
  'es-419': z.locales.es().localeError, // prumo:es-419
}

const requestLocale = new AsyncLocalStorage<Locale>()

// The language the request asks for: what the client's screen speaks, sent as Accept-Language, reaching one of the
// project's languages, else the base. Errors are written in it, and so is a code sent where no account says otherwise.
export function registerLocale(app: FastifyInstance): void {
  app.decorateRequest('locale', BASE_LOCALE)

  z.config({ localeError: (issue) => ZOD_MESSAGES[requestLocale.getStore() ?? BASE_LOCALE](issue) })

  app.addHook('onRequest', (request, _reply, done) => {
    request.locale = negotiateLocale(parseAcceptLanguage(request.headers['accept-language']))
    requestLocale.run(request.locale, done)
  })
}
