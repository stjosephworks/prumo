import type { Locale } from '@/i18n/locales'
import { en } from '@/i18n/messages/en' // prumo:en
import { es419 } from '@/i18n/messages/es-419' // prumo:es-419
import { ptBR } from '@/i18n/messages/pt-BR' // prumo:pt-BR

// The base language's messages are the shape every other language's must have: one missing does not compile.
export type Messages = typeof en

export const MESSAGES: Record<Locale, Messages> = {
  en, // prumo:en
  'pt-BR': ptBR, // prumo:pt-BR
  'es-419': es419, // prumo:es-419
}

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale]
}
