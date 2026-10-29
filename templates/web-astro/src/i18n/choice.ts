import { isLocale, type Locale, localeOfSegment, negotiateLocale, segmentOf } from '@/i18n/locales'
import { navigate } from '@/lib/navigate'

// Where this browser keeps the language a person chose here. A choice always wins over the browser's and the account's.
const STORED = 'locale'

export function chosenLocale(): Locale | undefined {
  try {
    const stored = localStorage.getItem(STORED)

    return stored !== null && isLocale(stored) ? stored : undefined
  } catch {
    // Storage can be unavailable, in a private window or with site data blocked: the choice then lasts the visit.
    return undefined
  }
}

export function keepChoice(locale: Locale): void {
  try {
    localStorage.setItem(STORED, locale)
  } catch {
    // Kept for the visit only, as above.
  }
}

// The same address in another language: its first segment swapped, or added where it names none.
export function pathIn(locale: Locale, pathname: string): string {
  const [, first = '', ...rest] = pathname.split('/')
  const tail = localeOfSegment(first) === undefined ? [first, ...rest] : rest

  return `/${[segmentOf(locale), ...tail].filter((part) => part !== '').join('/')}`
}

// An address without a language, as `/` or the API's links back, goes to the same address in the language chosen
// here, else the first of the browser's the project speaks, else the base. The pages are built ahead of time, so the
// browser does it.
export function sendToLanguage(): void {
  const locale = chosenLocale() ?? negotiateLocale(navigator.languages ?? [])

  navigate.replace(`${pathIn(locale, window.location.pathname)}${window.location.search}`)
}
