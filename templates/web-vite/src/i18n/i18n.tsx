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
import { BASE_LOCALE, isLocale, type Locale, negotiateLocale } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// zod's own messages, in each of the project's languages, for what a form refuses before it is sent.
const ZOD_MESSAGES: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: z.locales.en, // prumo:en
  'pt-BR': z.locales.pt, // prumo:pt-BR
  'es-419': z.locales.es, // prumo:es-419
}

// Where this browser keeps the language a person chose here. A choice always wins over the browser's and the account's.
const STORED = 'locale'

export function chosenLocale(): Locale | undefined {
  try {
    const stored = localStorage.getItem(STORED)

    return stored !== null && isLocale(stored) ? stored : undefined
  } catch {
    // Storage can be unavailable, in a private window or with cookies blocked: the choice then lasts the visit.
    return undefined
  }
}

function keep(locale: Locale): void {
  try {
    localStorage.setItem(STORED, locale)
  } catch {
    // Kept for the visit only, as above.
  }
}

// The language this browser chose here, else the first of its own the project speaks, else the base.
export function initialLocale(): Locale {
  return chosenLocale() ?? negotiateLocale(navigator.languages ?? [])
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
  // Whether a person chose the language on this browser, rather than it following the browser or the account.
  chosen: boolean
  choose: (locale: Locale) => void
  // Speaks the account's language where nothing was chosen here.
  follow: (locale: Locale) => void
}

const I18nContext = createContext<I18n>({
  locale: BASE_LOCALE,
  messages: messagesFor(BASE_LOCALE),
  chosen: false,
  choose: () => {},
  follow: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => ({
    locale: initialLocale(),
    chosen: chosenLocale() !== undefined,
  }))

  speaking = state.locale

  useEffect(() => {
    document.documentElement.lang = state.locale
    z.config(ZOD_MESSAGES[state.locale]())
  }, [state.locale])

  const choose = useCallback((locale: Locale) => {
    keep(locale)
    setState({ locale, chosen: true })
  }, [])

  const follow = useCallback((locale: Locale) => {
    setState((current) => (current.chosen ? current : { locale, chosen: false }))
  }, [])

  const value = useMemo(
    () => ({ ...state, messages: messagesFor(state.locale), choose, follow }),
    [state, choose, follow],
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
