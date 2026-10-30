import { useLocales } from 'expo-localization'
import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { z } from 'zod'
import { storage } from '@/features/storage/storage'
import { BASE_LOCALE, isLocale, type Locale, negotiateLocale } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// zod's own messages, in each of the project's languages, for what a form refuses before it is sent.
const ZOD_MESSAGES: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: z.locales.en, // prumo:en
  'pt-BR': z.locales.pt, // prumo:pt-BR
  'es-419': z.locales.es, // prumo:es-419
}

// Where the phone keeps what was chosen in the app: a language, or to follow the phone's. Not a user's data: it stays
// when one signs out.
const STORED = 'locale'

export type Choice = Locale | 'system'

export function storedChoice(): Choice | undefined {
  const stored = storage.getString(STORED)

  return stored === 'system' || (stored !== undefined && isLocale(stored)) ? stored : undefined
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
  // What was chosen in the app, if anything.
  chosen: Choice | undefined
  choose: (choice: Choice) => void
  // Speaks the account's language while nothing was chosen in the app.
  follow: (locale: Locale) => void
}

const I18nContext = createContext<I18n>({
  locale: BASE_LOCALE,
  messages: messagesFor(BASE_LOCALE),
  chosen: undefined,
  choose: () => {},
  follow: () => {},
})

// The language chosen in the app; else, where nothing was chosen, the account's; else the first of the phone's the
// project speaks, else the base. iOS and Android 13+ let a person choose this app's language in their settings, which
// the phone's list then leads with; useLocales follows it as it changes.
export function I18nProvider({ children }: { children: ReactNode }) {
  const phone = useLocales()
  const [chosen, setChosen] = useState(storedChoice)
  const [account, setAccount] = useState<Locale>()
  const fromPhone = negotiateLocale(phone.map((each) => each.languageTag))
  const locale =
    chosen === 'system' ? fromPhone : (chosen ?? (account === undefined ? fromPhone : account))

  speaking = locale

  useEffect(() => {
    z.config(ZOD_MESSAGES[locale]())
  }, [locale])

  const choose = useCallback((next: Choice) => {
    storage.set(STORED, next)
    setChosen(next)
  }, [])

  const value = useMemo(
    () => ({ locale, messages: messagesFor(locale), chosen, choose, follow: setAccount }),
    [locale, chosen, choose],
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
