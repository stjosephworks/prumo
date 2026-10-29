import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { z } from 'zod'
import { chosenLocale, pathIn } from '@/i18n/choice'
import { BASE_LOCALE, type Locale } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'
import { navigate } from '@/lib/navigate'

// zod's own messages, in each of the project's languages, for what a form refuses before it is sent.
const ZOD_MESSAGES: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: z.locales.en, // prumo:en
  'pt-BR': z.locales.pt, // prumo:pt-BR
  'es-419': z.locales.es, // prumo:es-419
}

// The language every request names in Accept-Language, which the API answers and writes a new account in.
let speaking: Locale = BASE_LOCALE

export function currentLocale(): Locale {
  return speaking
}

// Every request names the language the screen speaks, which the API answers in and writes a new account in.
export function withLanguage(transport: typeof fetch): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers)

    headers.set('accept-language', speaking)

    return transport(input, { ...init, headers })
  }
}

type I18n = {
  locale: Locale
  messages: Messages
  // Whether a person chose a language on this browser, rather than the address following the browser or the account.
  chosen: () => boolean
  // Moves to the account's language where nothing was chosen here.
  follow: (locale: Locale) => void
}

const I18nContext = createContext<I18n>({
  locale: BASE_LOCALE,
  messages: messagesFor(BASE_LOCALE),
  chosen: () => false,
  follow: () => {},
})

// The language is the page's: the page, built once per language, hands it to each island it mounts.
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  speaking = locale

  useEffect(() => {
    z.config(ZOD_MESSAGES[locale]())
  }, [locale])

  const follow = useCallback(
    (next: Locale) => {
      if (chosenLocale() === undefined && next !== locale) {
        navigate.to(`${pathIn(next, window.location.pathname)}${window.location.search}`)
      }
    },
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      messages: messagesFor(locale),
      chosen: () => chosenLocale() !== undefined,
      follow,
    }),
    [locale, follow],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  return useContext(I18nContext)
}

// The words of the language in use.
export function useMessages(): Messages {
  return useContext(I18nContext).messages
}

// An address of the app in the language in use: every link and every navigation goes through it.
export function useLocalePath(): (path: string) => string {
  const { locale } = useContext(I18nContext)

  return useCallback((path: string) => pathIn(locale, path), [locale])
}

// A message whose placeholders are filled with elements, as a name in bold: `format` for what is more than text.
export function rich(text: string, values: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((part) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]

    // Text needs no key; a placeholder is named once in a message, so its name is one.
    return name !== undefined && name in values ? (
      <Fragment key={name}>{values[name]}</Fragment>
    ) : (
      part
    )
  })
}
