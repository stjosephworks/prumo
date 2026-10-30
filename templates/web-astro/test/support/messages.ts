import { pathIn } from '@/i18n/choice'
import { BASE_LOCALE } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

// The words the app speaks in a test: the base language's, since setup.ts leaves the browser asking for none.
export const messages = messagesFor(BASE_LOCALE)

// The words of a message before its first placeholder, to find it with the value beside them.
export function startOf(message: string): RegExp {
  const start = (message.split('{')[0] ?? message).trim()

  return new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

// An address of the app in the base language, where every navigation of a test lands.
export function at(path: string): string {
  return pathIn(BASE_LOCALE, path)
}
