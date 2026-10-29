'use client'

import { usePathname, useRouter } from 'next/navigation'
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
import { BASE_LOCALE, isLocale, type Locale, localeOfSegment, segmentOf } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// zod's own messages, in each of the project's languages, for what a form refuses before it is sent.
const ZOD_MESSAGES: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: z.locales.en, // prumo:en
  'pt-BR': z.locales.pt, // prumo:pt-BR
  'es-419': z.locales.es, // prumo:es-419
}

// The cookie that keeps the language a person chose: proxy.ts reads it to send an address without a language to theirs.
export const CHOSEN_COOKIE = 'locale'

export function chosenLocale(): Locale | undefined {
  const value = document.cookie
    .split('; ')
    .find((pair) => pair.startsWith(`${CHOSEN_COOKIE}=`))
    ?.slice(CHOSEN_COOKIE.length + 1)

  return value !== undefined && isLocale(value) ? value : undefined
}

function keep(locale: Locale): void {
  document.cookie = `${CHOSEN_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

// The same address in another language: its first segment swapped.
export function pathIn(locale: Locale, pathname: string): string {
  const [, first = '', ...rest] = pathname.split('/')
  const tail = localeOfSegment(first) === undefined ? [first, ...rest] : rest

  return `/${[segmentOf(locale), ...tail].filter((part) => part !== '').join('/')}`
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
  choose: (locale: Locale) => void
  // Moves to the account's language where nothing was chosen here.
  follow: (locale: Locale) => void
}

const I18nContext = createContext<I18n>({
  locale: BASE_LOCALE,
  messages: messagesFor(BASE_LOCALE),
  chosen: () => false,
  choose: () => {},
  follow: () => {},
})

// The language is the address's: the layout reads it from the URL and hands it here.
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  speaking = locale

  useEffect(() => {
    z.config(ZOD_MESSAGES[locale]())
  }, [locale])

  const go = useCallback(
    (next: Locale) => router.push(`${pathIn(next, pathname)}${window.location.search}`),
    [router, pathname],
  )

  const choose = useCallback(
    (next: Locale) => {
      keep(next)
      go(next)
    },
    [go],
  )

  const follow = useCallback(
    (next: Locale) => {
      if (chosenLocale() === undefined && next !== locale) {
        go(next)
      }
    },
    [go, locale],
  )

  const value = useMemo(
    () => ({
      locale,
      messages: messagesFor(locale),
      chosen: () => chosenLocale() !== undefined,
      choose,
      follow,
    }),
    [locale, choose, follow],
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
